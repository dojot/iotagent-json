import fs = require("fs");
import util = require("util");
import {Agent} from "./agent";
import {DataBroker} from "./data-broker";
import {OrionHandler} from "./orion-handler";
import {KafkaHandler} from "./kafka-handler";

import { ConfigOptions, buildConfig } from "./config";
import { CacheHandler, DeviceManagerEvent, IdResolver } from "./cache";

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
    let cacheHandler = new CacheHandler();
    let idResolver = new IdResolver();

    if (configuration.broker.type == 'kafka') {
      console.log("Creating kafka handler");
      handler = new KafkaHandler(configuration, (event: DeviceManagerEvent) => {
        cacheHandler.processEvent(event);
        idResolver.processEvent(event);
      });
    } else if (configuration.broker.type == 'orion') {
      handler = new OrionHandler(configuration);
    } else {
      throw new Error('Invalid broker configuration detected: ' + configuration.broker.type);
    }

    let agent = new Agent(configuration, handler, cacheHandler, idResolver);
    agent.startMqtt();
  });
}


main();
