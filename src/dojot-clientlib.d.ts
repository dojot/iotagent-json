declare module 'dojot-clientlib' {
  export class AlarmConn {
    constructor ( hostname? : string, port? : string, username? : string, password? : string);
    close() : void;
    send(alarm : any) : void;
  }
}
