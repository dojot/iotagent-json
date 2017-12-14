import config = require("./config");
import util = require("util");
import {DataBroker, MetaAttribute} from "./data-broker";
import kafka = require("kafka-node");
import { DeviceManagerEvent } from "./cache";

/**
 * Class responsible for Kafka messaging
 */
class KafkaHandler implements DataBroker {
  // Broker IP address and port.
  host: string;

  // Main producer.
  private producer: kafka.HighLevelProducer;
  private isProducerReady: boolean;

  // Main consumer.
  private consumer: kafka.HighLevelConsumer;


  /**
   * Finish Kafka configuration.
   * 
   * If the consuimer creation fails, it will be tried again after one second.
   * 
   * @param config The configuration being used.
   * @param client Kafka client
   * @param callback The callback to be invoked when a device manager event is received.
   */
  private finishKafkaConfiguration(config: config.ConfigOptions, client: kafka.Client, callback: (data: DeviceManagerEvent) => void) {
    this.isProducerReady = true;

    if (config.broker.kafka !== undefined) {
      let topics = [];
      for (let topic of config.broker.kafka.deviceNotificationTopic) {
        topics.push(topic.topic);
      }
      console.log("Creating topics for consumer...");
      this.producer.createTopics(topics, false, (err, data) => { });
      console.log("... all topics were created.");

      console.log("Creating Kafka consumer...");
      this.consumer = new kafka.HighLevelConsumer(client, config.broker.kafka.deviceNotificationTopic, config.broker.kafka);
      // Kafka consumer events registration
      this.consumer.on("message", (data) => {
        let parsedData = JSON.parse(data.value.toString());
        callback(parsedData);
      });
      this.consumer.on("error", (err) => {
          console.log("Error: ", err);
          console.log("Will try again in a few seconds.");
          setTimeout(() => {
            console.log("Trying again.");
            this.finishKafkaConfiguration(config, client, callback);
          }, 1000)
      });
      console.log("... Kafka consumer created and callbacks registered.");
    }
  }

  /**
   * Start Kafka configuration.
   * 
   * If the producer creation fails, it will be tried again after one second.
   * 
   * @param config The configuration being used.
   * @param client Kafka clinet
   * @param callback The callback to be invoked when a device manager event is received.
   */
  private initKafkaConfiguration(config: config.ConfigOptions, callback: (data: DeviceManagerEvent) => void, client?: kafka.Client) {
    if (client === undefined) {
      console.log("Creating new Kafka client...");
      client = new kafka.Client(config.broker.host, "iotagent-json-" +  Math.floor(Math.random() * 10000));
      console.log("... Kafka client was created.");
    }
    
    console.log("Creating Kafka producer...");
    this.producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });

    // Kafka producer events registration
    this.producer.on("ready", () => {
      console.log("... Kafka producer creation finished.");
      this.finishKafkaConfiguration(config, client!, callback);
    });
    this.producer.on("error", (e) => { 
      console.error("Error: ", e); 
      console.log("Will try again in a few seconds.");
      setTimeout(() => {
        console.log("Trying again.");
        this.initKafkaConfiguration(config, callback);
      }, 1000)
    });
  }

  /**
   * 
   * @param config The configuration to be used.
   * @param callback A callback that will process received device manager notifications
   */
  constructor(config: config.ConfigOptions, callback: (data: DeviceManagerEvent) => void) {
    if (config.broker.type !== "kafka") {
      throw new Error("Invalid agent configuration detected");
    }

    if (config.broker.kafka === undefined) {
      console.log("No configuration detected for kafka. Bailing out.");
      return;
    }

    // Block any communication before producer is properly created.
    this.isProducerReady = false;
    this.initKafkaConfiguration(config, callback);
    console.log("... producer creation initialized and callbacks registered.");
  }

  // sends received device event to configured kafka topic
  updateData(service: string, deviceId: string, attributes: any, metaAttributes: MetaAttribute) {
    if (this.isProducerReady === false) {
      console.log("Kafka producer is not yet ready.");
      return;
    }
    
    if (metaAttributes.TimeInstant != undefined) {
      for (let attr of attributes) {
        // Only timestamp will be updated for now
        attr["meta"] = {
          TimeInstant: metaAttributes.TimeInstant
        }
      }
    }

    let updateData: any = {
      "metadata": {
        "deviceid": deviceId,
        "protocol": "mqtt",
        "payload": "json"
      },
      "attrs": attributes
    }

    let message: any = {
      "topic": "devices_" + service,
      "messages": [JSON.stringify(updateData)]
    }

    console.log("About to update device " + deviceId + " data");
    this.producer.send([message], (err: any, result: any) => {
      if (err) {
        console.error("Failed to update device data", err);
      } else {
        console.log("message away", result);
      }
    });
  }
}

export {KafkaHandler};
