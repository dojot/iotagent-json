import fs = require("fs");
import request = require("request");
import { ConfigOptions } from "./config";
import {tokenize} from "./tools";
import util = require("util");


// Device annotation interface
interface DeviceAnnotations {
  // Device ID
  id: string;
  // Associated device service
  service: string;
  // Flag indicating whether this can be cacheable by its topic
  cacheable: boolean;
}

// Device manager handler.
// This class is responsible to wrap all functions needed from device manager.
class DeviceManagerHandler {
  // Device manager address
  host: string;

  // Constructor.
  constructor(config: ConfigOptions) {
    this.host = config.device_manager.host;
  }

  // Retrieve annotations related to a message.
  getAnnotations(topic: string, message: any) : DeviceAnnotations {
    let ret = {"id" : "", "service": "", "cacheable": false};
    let topicTokens = tokenize(topic, '/');

    ret.service = topicTokens[1];
    ret.id = topicTokens[2];
    ret.cacheable = false;

    // TODO
    // The correct behaviour should be
    // - Check if detected device ID and service exists.
    // - If it does, send the update message to Orion.
    // - Otherwise, check if device manager can identify the
    // topic and message format.
    // - If it does, get the device ID, service and translated message
    // from the response and send the update message to Orion
    // - Otherwise, ignore the message.

    return ret;
  }

}


export {DeviceManagerHandler};