import fs = require("fs");
import util = require("util");
import mqtt = require("mqtt");
import mqttHandler = require("./mqtt-handler");
import jsonpatch = require("../src/jsonpatch")
import { JSONPatchInstruction } from "./jsonpatch"
import { ConfigOptions } from "./config";
import { tokenize } from "./tools";
import { DataBroker, MetaAttribute } from "./data-broker";
import { IdResolver, CacheHandler, DeviceManagerEvent } from "./cache";
import { resolve } from "url";
import { publish } from "./mqtt-handler";
import { OrionHandler } from "./orion-handler";
import { KafkaHandler } from "./kafka-handler";
import { Constants } from "./constants";

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

  // Kafka is always there.
  kafkaHandler: KafkaHandler;

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

    this.kafkaHandler = new KafkaHandler(this.configuration, (event: DeviceManagerEvent) => { this.processKafkaMessage(event) });
    // Start data broker (kafka or orion) communication
    switch (this.configuration.broker.type) {
      case "kafka":
        this.dataBroker = this.kafkaHandler;
        break;
      case 'orion':
        this.dataBroker = new OrionHandler(this.configuration);
        break;
      default:
        throw new Error('Invalid broker configuration detected: ' + this.configuration.broker.type);
    }
  }

  /**
   * Retrieve a list of translation instructions to be applied to a message.
   * 
   * TODO This might be better moved to some other entity.
   * 
   * @param deviceData The device to be analyzed
   * @returns A list of translators, if any.
   */
  static getTranslators(deviceData: DeviceManagerEvent) : JSONPatchInstruction []{
    let translators: JSONPatchInstruction[] = [];
    for (let template in deviceData.data.attrs) {
      for (let cfgAttr of deviceData.data.attrs[template]) {
        // Check for translators.
        // Attribute name could be anything.
        if ((cfgAttr.type === Constants.TRANSLATOR_TYPE) &&
          (cfgAttr.static_value != undefined)) {
          translators.push(JSON.parse(cfgAttr.static_value));
        }
      }
    }
    return translators;
  }

  /**
   * Filter out all non-registered device attributes
   * @param messageObj The received message to be filtered
   * @param mgmEvent The associated device data structure
   */
  static filterRegisteredAttributes(messageObj: any, mgmEvent: DeviceManagerEvent) : any {
    // Filtering out all non-registered device attributes
    let filteredObj: any = {};
    for (let attr in messageObj) {
      for (let template in mgmEvent.data.attrs) {
        for (let cfgAttr of mgmEvent.data.attrs[template]) {
          if (cfgAttr.label === attr) {
            filteredObj[attr] = messageObj[attr];
            // Found it. Next attribute
            break;
          }
        }
      }
    }
    return filteredObj;
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

    // Received message object - this could be anything.
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

    let mgmEvent = this.cacheHandler.lookup(id);
    if (mgmEvent == null) {
      console.log("No device data was found in cache. Bailing out.")
      return
    }

    messageObj = jsonpatch.apply_patch(messageObj, Agent.getTranslators(mgmEvent));
    
    // Adding timestamp to the message if not present
    let metaData: MetaAttribute = {};
    if (messageObj["TimeInstant"] != undefined) {
      metaData.TimeInstant = messageObj["TimeInstant"];
    }

    // Filtering out all non-registered device attributes
    let filteredObj = Agent.filterRegisteredAttributes(messageObj, mgmEvent);

    console.log("Sending device update: ");
    console.log("Device ID: " + id);
    console.log("Service: " + mgmEvent.meta.service);
    console.log("Data: ");
    console.log(util.inspect(filteredObj, { depth: null }));
    this.dataBroker.updateData(mgmEvent.meta.service, id, filteredObj, metaData);
  }


  /**
   * Process a Kafka message
   * @param event The received event message
   */
  processKafkaMessage(event: DeviceManagerEvent) : void {
    switch (event.event) {
      case Constants.Kakfa.CREATE_EVENT:
      case Constants.Kakfa.REMOVE_EVENT:
      case Constants.Kakfa.UPDATE_EVENT:
        this.cacheHandler.processEvent(event);
        this.idResolver.processEvent(event);
        break;
      case Constants.Kakfa.ACTUATE_EVENT:
        // TODO The message could be verified if it is
        // valid.
        console.log("Processing configure message");
        let device = this.cacheHandler.lookup(event.data.id);
        if (device == null) { 
          console.log("No such device was found in cache. Bailing out.");
          return; 
        };

        console.log("Found device: " + util.inspect(device, {depth: null}))

        let topic = "";
        for (let template_id in device.data.attrs) {
          for (let templ_attrs of device.data.attrs[template_id]) {
            if ((templ_attrs.label == Constants.MQTT_ACTUATE_TOPIC_LABEL) && 
                (templ_attrs.type == Constants.CONFIGURATION_TYPE)) {
              topic = templ_attrs.static_value;
            }
          }
        }

        //
        // TODO There should also be a check whether the attribute is 'actuator'
        // type
        //

        if (topic == "") { 
          console.log("Falling back to /SERVICE/ID/config scheme");
          topic = "/" + event.meta["service"] + "/" + event.data.id + "/config"
        }
        console.log("Publishing to topic " + topic);
        publish(this.mqttContext, topic, event.data);
        break;
      default:
    }
  };
}


export { Agent };

