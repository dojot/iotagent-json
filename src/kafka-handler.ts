import util = require("util");
import kafka = require("kafka-node");
import axios, {AxiosResponse, AxiosError} from 'axios';
import config = require("./config");
import {DataBroker, MetaAttribute} from "./data-broker";
import { DeviceManagerEvent } from "./cache";

/**
 * Class responsible for Kafka messaging
 */
export class KafkaHandler implements DataBroker {
  // Broker IP address and port.
  host: string;

  // Maps tenants to services to kafka topics
  topicMap: {[tenant: string]: {[service: string]:string}};
  private publishingSubject: string;
  private contextBroker: string;

  // Main producer.
  private producer: kafka.HighLevelProducer;
  private isProducerReady: boolean;

  // Main consumer.
  private consumer: kafka.HighLevelConsumer;

  /**
   * @param config The configuration to be used.
   * @param callback A callback that will process received device manager notifications
   */
  constructor(config: config.ConfigOptions, callback: (data: DeviceManagerEvent) => void) {
    // Block any communication before producer is properly created.
    this.isProducerReady = false;
    this.initKafkaConfiguration(config, callback, "producer");

    if (config.broker.type == 'kafka') {
      this.contextBroker = config.broker.contextBroker ? config.broker.contextBroker : 'data-broker';
      this.publishingSubject = config.broker.subject ? config.broker.subject : 'device-data';
      this.topicMap = {};
    }
  }

  /**
   * Start Kafka configuration.
   *
   * If the producer creation fails, it will be tried again after one second.
   * TODO make retry period (or even attempt) configurable
   *
   * @param config   The configuration being used.
   * @param client   Kafka clinet
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
              }, 10000);
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
        console.log("Creating Kafka consumer...");
        this.getPublishTopic('admin', config.device_manager.inputSubject, (err?:any, topic?: string) => {
          if (err || (topic == undefined)) {
            console.error('Failed to retrieve input topic');
            process.exit(1);
          }

          this.consumer = new kafka.ConsumerGroup(config.device_manager.consumerOptions, topic!);

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
            }, 10000)
          });

          console.log("... Kafka consumer created and callbacks registered.");
        })
        break;
    }
  }

  /**
   * Retrieves managed topic id based on given tenant and subject
   * @param  tenant   Tenant for which a topic is to be retrieved
   * @param  subject  Subject of the topic to be retrieved
   * @param  callback Who to call once a topic is obtained
   * @return void
   */
  private getPublishTopic(tenant: string, subject: string, callback: (err?: any, topic?:string) => void): void {
    if (tenant in this.topicMap) {
      if (subject in this.topicMap[tenant]){
        callback(undefined, this.topicMap[tenant][subject]);
        return;
      }
    }

    function generateJWT() {
      const payload = {
        'service': tenant,
        'username': 'iotagent'
      }
      return (new Buffer('dummy jwt schema').toString('base64')) + '.'
             + (new Buffer(JSON.stringify(payload)).toString('base64')) + '.'
             + (new Buffer('dummy signature').toString('base64'));

    }

    axios({
      'url': this.contextBroker + '/topic/' + subject,
      'method': 'get',
      'headers': {'authorization': 'Bearer ' + generateJWT()}
    }).then((response: AxiosResponse) => {
      if (! (this.topicMap[tenant])) {
        this.topicMap[tenant] = {};
      }
      this.topicMap[tenant][subject] = response.data.topic;
      callback(undefined, this.topicMap[tenant][subject]);
    }).catch((error: AxiosError) => {
      callback(error.message, undefined);
    })
  }

  /**
   * sends received device event to configured kafka topic
   * @param  service        Tenant which oversees the device
   * @param  deviceId       Device from which data originated
   * @param  attributes     Actual device data
   * @param  metaAttributes Event metadata
   * @return void
   */
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

    this.getPublishTopic(service, this.publishingSubject, (err?:any, topic?: string) => {
      if (err || (topic == undefined)) {
        console.error("Failed to determine output topic", err);
        return;
      }

      let message: any = {
        "topic": topic,
        "messages": [JSON.stringify(updateData)]
      }

      console.log("About to update device %s data on [%s]", deviceId, topic);
      this.producer.send([message], (err: any, result: any) => {
        if (err) {
          console.error("Failed to update device data", err);
        } else {
          console.log("message away", result);
        }
      });
    })
  }
}
