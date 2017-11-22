import fs = require("fs");
import util = require("util");
import {Agent} from "./iotagent-json";
import {DataBroker} from "./data-broker";
import {OrionHandler} from "./orion-handler";
import {KafkaHandler} from "./kafka-handler";
import {DeviceManagerHandler} from "./device-manager-handler";

import { ConfigOptions, buildConfig } from "./config";

function main() {
  // Simple sanity check. Configuration file must be present.
  if (process.argv.length != 3) {
    console.log("Usage: node " + process.argv[1] + " CONFIG_FILE.json ")
    return;
  }

  // Load configuration file.
  fs.readFile(process.argv[2], function (err, data) {
    if (err) {
      return console.error(err);
    }
    let configuration = buildConfig(JSON.parse(data.toString()));

    let handler: DataBroker;
    if (configuration.broker.type == 'kafka') {
      handler = new KafkaHandler(configuration);
    } else if (configuration.broker.type == 'orion') {
      handler = new OrionHandler(configuration);
    } else {
      throw new Error('Invalid broker configuration detected: ' + configuration.broker.type);
    }

    let deviceManagerHandler = new DeviceManagerHandler(configuration);
    let agent = new Agent(configuration, handler, deviceManagerHandler);
    agent.startMqtt();
  });
}


main();
