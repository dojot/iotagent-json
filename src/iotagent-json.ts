import fs = require("fs");
import util = require("util");
import mqtt = require("mqtt");
import mqttHandler = require("./mqtt-handler");
import { ConfigOptions } from "./config";
import { DeviceManagerHandler } from "./device-manager-handler";
import { tokenize } from "./tools";
import { DataBroker } from "./data-broker";

// IoT agent class
// This class is responsible for orchestrating MQTT handler and
// Device manager handler, sending Orion update messages as
// needed.
class Agent {
  configuration: ConfigOptions;
  mqttContext: mqtt.Client;
  dataBroker: DataBroker;
  deviceManagerHandler: DeviceManagerHandler;

  constructor(config: ConfigOptions, dataBroker: DataBroker, deviceManager: DeviceManagerHandler) {
    this.configuration = config;
    this.dataBroker = dataBroker;
    this.deviceManagerHandler = deviceManager;
  };

  mqttErrorCallback(error: Error) {
    console.log("Error with MQTT operation: " + error);
  }

  processMessage(topic: string, message: string) {
    console.log('Got new MQTT message');
    console.log('Topic: ' + topic);
    console.log('Content:' + message);

    let messageObj = JSON.parse(message);
    let annotations = this.deviceManagerHandler.getAnnotations(topic, messageObj);

    console.log("Got annotations: " + util.inspect(annotations, {depth: null}));

    if (annotations != null) {
      // Message matches default message structure
      console.log("Sending update to orion...");
      this.dataBroker.updateData(annotations.service, annotations.id, messageObj);
      console.log("... device updated");
    }
  }

  startMqtt() {
    this.mqttContext = mqttHandler.start(this.configuration, (topic: string, message: string) => { this.processMessage(topic, message); }, this.mqttErrorCallback);
  }

  stopMqtt() {
    mqttHandler.stop(this.mqttContext, this.mqttErrorCallback);
  }
}

export {Agent};