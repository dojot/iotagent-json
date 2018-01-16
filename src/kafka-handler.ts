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
   * Start Kafka configuration.
   * 
   * If the producer creation fails, it will be tried again after one second.
   * 
   * @param config The configuration being used.
   * @param client Kafka clinet
   * @param callback The callback to be invoked when a device manager event is received.
   */
  private initKafkaConfiguration(config: config.ConfigOptions, callback: (data: DeviceManagerEvent) => void, type: string) {
    let isScheduled = false;
    switch (type) {
      case "producer":
        if (config.broker.type === "kafka") {
          console.log("Creating Kafka producer...");
          let client = new kafka.Client(config.broker.host, "iotagent-json-producer-" +  Math.floor(Math.random() * 10000));
          console.log("... Kafka client for producer is ready.");
          console.log("Creating Kafka producer...");
          this.producer = new kafka.HighLevelProducer(client, { requireAcks: 1 });
      
          // Kafka producer events registration
          this.producer.on("ready", () => {
            console.log("... Kafka producer creation finished.");
            this.isProducerReady = true;
            this.initKafkaConfiguration(config, callback, "consumer");
          });
          this.producer.on("error", (e) => { 
            if (isScheduled == true) {
              console.log("An operation was already scheduled. No need to do it again.");
              return;
            }
            this.producer.close();
            isScheduled = true;
            console.error("Error: ", e); 
            console.log("Will try again to create Kafka producer in a few seconds.");
              setTimeout(() => {
                console.log("Trying again.");
                this.initKafkaConfiguration(config, callback, "producer");
              }, 100);
          });
          console.log("... Kafka producer created and callbacks registered.");
        } else {
          console.log("Data broker is not Kafka. Skipping producer creation.");
          this.isProducerReady = true;
          this.initKafkaConfiguration(config, callback, "consumer");
        }
        break;
      case "consumer":
        console.log("Creating new Kafka client...");
        // First try
        // Creating consumer client - from device manager to iotagent.
        // This is always used.
        let client = new kafka.Client(config.device_manager.kafkaHost, "iotagent-json-consumer-" +  Math.floor(Math.random() * 10000));
        console.log("... Kafka client for consumer is ready.");
        console.log("Creating Kafka consumer...");
        this.consumer = new kafka.HighLevelConsumer(client, config.device_manager.kafkaTopics, config.device_manager.kafkaOptions);
        // Kafka consumer events registration
        this.consumer.on("message", (data) => {
          let parsedData = JSON.parse(data.value.toString());
          callback(parsedData);
        });
        this.consumer.on("error", (err) => {
          if (isScheduled == true) {
            console.log("An operation was already scheduled. No need to do it again.");
            return;
          }
          console.log("Closing current consumer.");
          this.consumer.close(true, (e) => { 
            console.log("Result of consumer close operation: " + e);
          });

          isScheduled = true;
          console.log("Error: ", err);
          console.log("Will try again to create Kafka consumer in a few seconds.");
          setTimeout(() => {
            console.log("Trying again.");
            this.initKafkaConfiguration(config, callback, "consumer");
          }, 100)
        });

        console.log("... Kafka consumer created and callbacks registered.");
        break;
    }
  }

  /**
   * 
   * @param config The configuration to be used.
   * @param callback A callback that will process received device manager notifications
   */
  constructor(config: config.ConfigOptions, callback: (data: DeviceManagerEvent) => void) {
    // Block any communication before producer is properly created.
    this.isProducerReady = false;
    this.initKafkaConfiguration(config, callback, "producer");
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
