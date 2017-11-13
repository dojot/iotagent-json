import request = require("request");
import util = require("util");
import { Base64 } from "js-base64";
import { ConfigOptions } from "./config";
import { tokenize } from "./tools";

// Device attribute interface
interface DeviceAttribute {
  type: string;
  name: string;
  object_id: string;
}

// Device annotation interface
interface DeviceAnnotations {
  // Device ID
  id: string;
  // Associated device service
  service: string;
  // Flag indicating whether this can be cacheable by its topic
  cacheable: boolean;
  // Device parameters
  deviceData: DeviceAttribute[]
}

interface AnnotationCallback {
    (error: any, annotation: DeviceAnnotations): void;
}

// Device manager handler.
// This class is responsible to wrap all functions needed from device manager.
class DeviceManagerHandler {
  // Device manager address
  host: string;
  // Tokens used so far
  tokens: any;

  // Constructor.
  constructor(config: ConfigOptions) {
    this.host = config.device_manager.host;
    this.tokens = {};
  }

  // Callback to device manager request.
  deviceCallback(error: any, response: request.RequestResponse, body: any, annotations: DeviceAnnotations, callback: AnnotationCallback): void {
    if (error != undefined) {
      console.log("Error while retrieving device data: " + util.inspect(error, {depth: null}));
    } else {
      // Ok!
      if (response.statusCode == 200) {
        annotations.deviceData = JSON.parse(body).attrs;
      } else {
        error = { "status" : response.statusCode, "msg": response.statusMessage};
      }
    }

    callback(error, annotations);
  }

  // Retrieve annotations related to a message.
  getAnnotations(topic: string, message: any, callback: AnnotationCallback) : void {
    let ret = {"id" : "", "service": "", "cacheable": false, "deviceData": []};
    let topicTokens = tokenize(topic, '/');

    ret.service = topicTokens[1];
    ret.id = topicTokens[2];
    ret.cacheable = false;

    if (!(ret.service in this.tokens)) {
      // Dummy token to request device manager
      this.tokens[ret.service] = "a." + Base64.encode('{"service": "'+ret.service+'"}') + ".c";
    }

    let options: request.CoreOptions = {
      method: "GET",
      headers: {
        "Authorization": this.tokens[ret.service],
      }
    }

    // Is there any return value?
    request("http://" + this.host + "/device/" + ret.id, options, (error: any, response: request.RequestResponse, body: any) => { this.deviceCallback(error, response, body, ret, callback)});
  }

}

export {DeviceManagerHandler};
export {AnnotationCallback};
export {DeviceAnnotations};