import fs = require("fs");
import util = require("util");
import mqtt = require("mqtt");
import mqttHandler = require("./mqtt-handler");
import jsonpatch = require("../src/jsonpatch")
import { ConfigOptions } from "./config";
import { tokenize } from "./tools";
import { DataBroker, MetaAttribute } from "./data-broker";
import { IdResolver, CacheHandler, DeviceManagerEvent } from "./cache";
import { resolve } from "url";
import { publish } from "./mqtt-handler";
import { OrionHandler } from "./orion-handler";
import { KafkaHandler } from "./kafka-handler";

/**
 * IoT agent class
 * This class is responsible for orchestrating MQTT handler and
 * Device manager handler, sending Orion update messages as
 * needed.
 */
class Agent {
  // Main configuration structure.
  configuration: ConfigOptions;

  // MQTT Context used by this agent.
  // This is only necessary when stopping MQTT.
  mqttContext: mqtt.Client;

  // Broker which will receive device update messages.
  dataBroker: DataBroker;

  // Cache which will hold everything (almost) received via kafka.
  cacheHandler: CacheHandler;

  // Tool to find out the device ID from a received message.
  idResolver: IdResolver

  constructor(config: ConfigOptions) {
    if ((config.broker.type !== 'kafka') && (config.broker.type !== 'orion')) {
      throw new Error('Invalid broker configuration detected: ' + config.broker.type);
    }

    this.configuration = config;
    this.cacheHandler = new CacheHandler();
    this.idResolver = new IdResolver();
  }

  start() {
    // Start MQTT communication
    this.mqttContext = mqttHandler.start(this.configuration,
      // We must not loose the 'this' reference.
      (topic: string, message: string) => { this.processMqttMessage(topic, message); },
      (error: Error) => {
        console.log("Error with MQTT operation: " + error);
      });

    // Start data broker (kafka or orion) communication
    switch (this.configuration.broker.type) {
      case "kafka":
        this.dataBroker = new KafkaHandler(this.configuration,
          // We must not loose the 'this' reference.
          (event: DeviceManagerEvent) => { this.processKafkaMessage(event) });
        break;
      case 'orion':
        this.dataBroker = new OrionHandler(this.configuration);
        break;
      default:
        throw new Error('Invalid broker configuration detected: ' + this.configuration.broker.type);
    }
  }

  /**
   * Process a message received via MQTT
   * @param {string} topic The topic through which the message was published
   * @param {string} message The received message
   */
  processMqttMessage(topic: string, message: string): void {
    console.log('Got new MQTT message');
    console.log('Topic: ' + topic);
    console.log('Content:' + message);

    let messageObj: any;
    try {
      messageObj = JSON.parse(message);
    } catch (e) {
      console.log('Failed to parse incoming data\n', e);
      return
    }

    // The message 'format' can be detected by its topic.
    // TODO: the user might choose to use this 'message topic format switch'
    // as a "/device/+/deviceinfo"
    let id = this.idResolver.resolve(topic, messageObj, { "topic": topic });
    if (id === "") {
      console.log("No device ID was detected. Skipping this message.");
      // TODO emit iotagent warning
      return;
    }
    console.log("Detected device ID: " + id);

    let deviceData = this.cacheHandler.lookup(id);
    let translator = [];
    // Find translators:
    for (let template in deviceData.data.attrs) {
      for (let cfgAttr of deviceData.data.attrs[template]) {
        // Check for translators
        // TODO This could be a meta-attribute
        if (cfgAttr.label === "translator" && cfgAttr.static_value != undefined) {
          translator.push(JSON.parse(cfgAttr.static_value));
        }
      }
    }

    if (translator != undefined) {
      console.log("There is a translator for this device.");
      console.log("Translating message...");
      messageObj = jsonpatch.apply_patch(messageObj, translator);
      console.log("... message translated.");
    }

    let metaData: MetaAttribute = {};
    if (messageObj["TimeInstant"] != undefined) {
      metaData.TimeInstant = messageObj["TimeInstant"];
    }

    let filteredObj: any = {};
    // Message matches default message structure
    for (let attr in messageObj) {
      for (let template in deviceData.data.attrs) {
        for (let cfgAttr of deviceData.data.attrs[template]) {
          if (cfgAttr.label === attr) {
            filteredObj[attr] = messageObj[attr];
            // Found it. Next attribute
            break;
          }
        }
      }
    }

    console.log("Sending device update: ");
    console.log("Device ID: " + id);
    console.log("Service: " + deviceData.meta.service);
    console.log("Data: ");
    console.log(util.inspect(filteredObj, { depth: null }));
    this.dataBroker.updateData(deviceData.meta.service, id, filteredObj, metaData);
  }

  processKafkaMessage(event: DeviceManagerEvent) {
    switch (event.event) {
      case "create":
      case "remove":
      case "update":
        this.cacheHandler.processEvent(event);
        this.idResolver.processEvent(event);
        break;
      case "configure":
        // TODO The message could be verified if it is
        // valid.
        publish(this.mqttContext, event.meta["topic"], event.data);
        break;
      default:
    }
  };
}


export { Agent };

