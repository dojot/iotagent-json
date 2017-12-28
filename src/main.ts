import fs = require("fs");
import util = require("util");
import {Agent} from "./agent";
import {DataBroker} from "./data-broker";
import {OrionHandler} from "./orion-handler";
import {KafkaHandler} from "./kafka-handler";

import { ConfigOptions } from "./config";

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
    let configuration: ConfigOptions = JSON.parse(data.toString());
    console.log("Detected configuration: " + util.inspect(configuration, {depth: null}));
    let agent = new Agent(configuration);
    agent.start();
  });
}


main();
