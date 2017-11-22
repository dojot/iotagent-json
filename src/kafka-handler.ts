import config = require("./config");
import util = require("util");
import {DataBroker} from "./data-broker";
import kafka = require('kafka-node');

class KafkaHandler implements DataBroker {
  host: string;
  topic: string;
  producer: kafka.HighLevelProducer;

  constructor(config: config.ConfigOptions) {
    if (config.broker.type !== "kafka") {
      throw new Error("Invalid agent configuration detected");
    }

    // initialize kafka communication
    let client = new kafka.Client(config.broker.host);
    this.producer = new kafka.HighLevelProducer(client, {requireAcks: 1});
    this.producer.on('ready', () => {
      console.log('kafka connection initialized');
    });
    this.producer.on('error', (e) => {console.error('error', e);});
  }

  // createTopics() {
  //   this.producer.createTopics([this.topic], function(err, data){
  //     if (err) {
  //       console.error("failed to create topics", err);
  //     }
  //   });
  // }


  // sends received device event to configured kafka topic
  updateData(service: string, deviceId: string, attributes: any) {
    let updateData: any = {
      'meta': {'deviceid': deviceId},
      'data': attributes
    }

    let message: any = {
      'topic': 'devices_' + service,
      'messages': [JSON.stringify(updateData)]
    }

    console.log('About to update device ' + deviceId + ' data');
    this.producer.send([message], (err: any, result: any) => {
      if (err) {
        console.error('Failed to update device data', err);
      } else {
        console.log('message away', result);
      }
    });
  }
}

export {KafkaHandler};
