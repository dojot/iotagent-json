import config = require("./config");
import request = require("request");
import util = require("util");
import {DataBroker, MetaAttribute} from "./data-broker";

class OrionHandler implements DataBroker {
  host: string;
  constructor(config: config.ConfigOptions) {
    if (config.broker.type == "orion") {
      this.host = config.broker.host;
    }
  }

  updateCallback(error: any, response: request.RequestResponse, body: any): void {
    if (error != undefined) {
      console.log("Error while posting device update: " + util.inspect(error, {depth: null}));
    } else {
      // Ok!
      console.log("Device updated successfully. " + response.statusCode);
    }
  }

  updateData(service: string, deviceId: string, attributes: any, metaAttributes: MetaAttribute) {
    let updateData: any = { }

    
    if (metaAttributes.TimeInstant != undefined) {
      for (let attr in attributes) {
        updateData[attr] = {
          "value": attributes[attr],
          "metadata": {
            "name" : "TimeInstant",
            "type": "ISO8601",
            "value" : metaAttributes.TimeInstant
          }
        }
      }
    } else {
      for (let attr in attributes) {
        updateData[attr] = {
          "value": attributes[attr]
        }
      }
    }

    let options: request.CoreOptions = {
      method: "PUT",
      headers: {
        "Fiware-Service": service,
        "Fiware-ServicePath": "/",
        "Content-Type": "application/json"
      },
      json: updateData
    }

    // Is there any return value?
    request("http://" + this.host + "/v2/entities/" + deviceId + "/attrs", options, this.updateCallback);
  }
}

export {OrionHandler};
