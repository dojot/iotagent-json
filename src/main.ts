import fs = require("fs");
import util = require("util");
import {Agent} from "./iotagent-json";
import {OrionHandler} from "./orion-handler";
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
    let orionHandler = new OrionHandler(configuration);
    let deviceManagerHandler = new DeviceManagerHandler(configuration);
    let agent = new Agent(configuration, orionHandler, deviceManagerHandler);
    agent.startMqtt();
  });
}


main();