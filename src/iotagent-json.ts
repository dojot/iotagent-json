import fs = require("fs");
import util = require("util");
import mqtt = require("mqtt");
import mqttHandler = require("./mqtt-handler");
import { ConfigOptions } from "./config";
import { DeviceManagerHandler, AnnotationCallback, DeviceAnnotations } from "./device-manager-handler";
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

  annotationCallback(error: any, annotation: DeviceAnnotations, messageObj: any): void {
    console.log("Got annotations: " + util.inspect(annotation, {depth: null}));
    let filteredObj: any = {};
    if (error == undefined) {
      // Message matches default message structure
      for (let attr in messageObj) {
        for (let template in annotation.deviceData) {
          for (let cfgAttr of annotation.deviceData[template]) {
            if (cfgAttr.label === attr) {
              filteredObj[attr] = messageObj[attr];
              // Found it. Next attribute
              break;
            }
          }
        }
      }

      console.log("Received values for valid attributes: " + util.inspect(filteredObj, {depth: null}));
      console.log("Sending update to orion...");
      this.dataBroker.updateData(annotation.service, annotation.id, filteredObj);
      console.log("... device updated");
    } else {
      console.log("Failure while retrieving device data. Probably it doesn't exist.");
    }
  }

  processMessage(topic: string, message: string) {
    console.log('Got new MQTT message');
    console.log('Topic: ' + topic);
    console.log('Content:' + message);
    let messageObj = JSON.parse(message);

    this.deviceManagerHandler.getAnnotations(topic, messageObj, (error: any, annotation: DeviceAnnotations): void => { this.annotationCallback(error, annotation, messageObj)} );
  }

  startMqtt() {
    this.mqttContext = mqttHandler.start(this.configuration, (topic: string, message: string) => { this.processMessage(topic, message); }, this.mqttErrorCallback);
  }

  stopMqtt() {
    mqttHandler.stop(this.mqttContext, this.mqttErrorCallback);
  }
}

export {Agent};
