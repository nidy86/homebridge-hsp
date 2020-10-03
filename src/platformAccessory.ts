import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { HspPlatform } from './platform';

import { Headers } from 'node-fetch';
import fetch from 'node-fetch';
import md5 from 'md5';

export default class HspPlatformAccessory {
  private runService: Service;
  private weekPrgService: Service;
  private ecoModeService: Service;
  private actualTempService: Service;
  private stateService: Service;
  private setTempService: Service;

  private state = {
    On: false,
    Brightness: 0,
    Cooling: 100,
  }

  private url = 'localhost';

  private msg = {
    payload: {
      start: false,
      weekProgramStart: false,
      mode: 'unknown',
      isTemp: 0.0,
      setTemp: 0.0,
      ecoMode: false,
      nonce: 'unknown',
      error: false,
      meta: {
        softwareVersion: 'unknown',
        language: 'unknown',
        type: 'HSP-1/2',
        serialNumber: '0000000',
      },
      pgi: false,
      ignitions: -1,
      onTime: -1,
      consumption: -1,
      maintenance: -1,
      cleaning: -1,
      zone: 0,
    },
  };

  constructor(
    private readonly platform: HspPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    this.url = this.platform.config.host as string;
    const interval = this.platform.config.interval as number * 1000;
    
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Haas+Sohn')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.config.type as string)//'HSP 2.17 Home II')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.platform.config.serial as string);

    
    this.runService = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    this.runService.setCharacteristic(this.platform.Characteristic.Name, 'Ofen eingeschalten');

    this.runService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setRunningOn.bind(this))
      .on('get', this.getRunningOn.bind(this));

    this.actualTempService = this.accessory.getService('Raumtemperatur') ||
      this.accessory.addService(this.platform.Service.TemperatureSensor, 'Raumtemperatur', 'HSP-isTemp');
    
    this.actualTempService.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .on('get', this.getActualTemperature.bind(this));

    this.stateService = this.accessory.getService('Status') ||
      this.accessory.addService(this.platform.Service.Lightbulb, 'Status', 'HSP-state');

    this.stateService.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setStateBrightness.bind(this))
      .on('get', this.getStateBrightness.bind(this));

    this.stateService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setState.bind(this))
      .on('get', this.getState.bind(this));
    

    this.weekPrgService = this.accessory.getService('Wochenprogramm') ||
      this.accessory.addService(this.platform.Service.Switch, 'Wochenprogramm', 'HSP-weekProgrammStart');

    this.weekPrgService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setWeekProgrammOn.bind(this))
      .on('get', this.getWeekProgrammOn.bind(this));

    
    this.ecoModeService = this.accessory.getService('Eco-Mode') ||
      this.accessory.addService(this.platform.Service.Switch, 'Eco-Mode', 'HSP-ecoMode');

    this.ecoModeService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setEcoModeOn.bind(this))
      .on('get', this.getEcoModeOn.bind(this));




    this.setTempService = this.accessory.getService('Solltemperatur') ||
      this.accessory.addService(this.platform.Service.InputSource, 'Solltemperatur', 'HSP-setTemp');

    this.setTempService.getCharacteristic(this.platform.Characteristic.ConfiguredName)
      .on('get', this.handleConfiguredNameGet.bind(this))
      .on('set', this.handleConfiguredNameSet.bind(this));

    this.setTempService.getCharacteristic(this.platform.Characteristic.InputSourceType)
      .on('get', this.handleInputSourceTypeGet.bind(this));

    this.setTempService.getCharacteristic(this.platform.Characteristic.IsConfigured)
      .on('get', this.handleIsConfiguredGet.bind(this));

    this.setTempService.getCharacteristic(this.platform.Characteristic.Name)
      .on('get', this.handleNameGet.bind(this));

    this.setTempService.getCharacteristic(this.platform.Characteristic.CurrentVisibilityState)
      .on('get', this.handleCurrentVisibilityStateGet.bind(this));
      
    
    /**
     * TEST Section: Define
     */
    
    
    /**
     * Updating characteristics values asynchronously.
     * 
     */
    setInterval(async () => {
      this.fetchInformation();
    }, interval);
  }

  async fetchInformation(){
    //const response = await fetch(`http://${this.url}/status.cgi`);
    //const data = await response.json();
    await fetch(`http://${this.url}/status.cgi`)
      .then(response => {
        if(response.ok){
          response.json().then((data)=>{
            //let changed = this.msg.payload.weekProgramStart!=data.wprg;
            //this.platform.log.debug('Weekprogramm changed',changed);


            this.hspUpdatePayload(data);
            //this.platform.log.debug('response:',this.msg.payload);

            // push the new value to HomeKit
            this.actualTempService.updateCharacteristic(
              this.platform.Characteristic.CurrentTemperature, 
              this.msg.payload.isTemp.toFixed(1),
            );

            this.setTempService.updateCharacteristic(
              this.platform.Characteristic.InputSourceType.ConfiguredName, 
              this.msg.payload.setTemp.toFixed(0),
            );

            
            this.runService.updateCharacteristic(this.platform.Characteristic.On, this.msg.payload.start);
            this.weekPrgService.updateCharacteristic(this.platform.Characteristic.On, this.msg.payload.weekProgramStart);
            this.ecoModeService.updateCharacteristic(this.platform.Characteristic.On, this.msg.payload.ecoMode);

            this.stateService.updateCharacteristic(this.platform.Characteristic.Brightness, this.getHeatingState());
            

            

            this.platform.log.debug('Temperature (ACTUAL/SET):', this.msg.payload.isTemp.toFixed(1), this.msg.payload.setTemp.toFixed(1));
          });
        } else {
          this.platform.log.debug('RESPONSE is broken. Waiting for next request.');
        }
      }).catch(error => {
        this.platform.log.debug('FETCH-ERROR from url. Waiting for next request...');
      });
  }

  /**
   * REQUIRED - This must return an array of the services you want to expose.
   * This method must be named "getServices".
   */
  getServices(){
    return [
      this.runService,
      this.weekPrgService,
      this.ecoModeService,
      this.actualTempService,
      this.stateService,
      this.setTempService,
    ];
  }
  

  async setWeekProgrammOn(value: CharacteristicValue, callback: CharacteristicSetCallback){
    if(this.msg.payload.weekProgramStart !== value as boolean){
      this.msg.payload.weekProgramStart = value as boolean;
      this.platform.log.debug('Set WeekProgrammStart On ->', value);
    
      const nonce = await this.hspGetNonce();
      //this.platform.log.debug("nonce: ",nonce);

      const hash = this.hspCalculatePin(nonce, this.platform.config.pin as string);
      
      const setData = {};
      setData['wprg'] = value as boolean;

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url, hash);
      
      const response = await fetch(`http://${this.url}/status.cgi`, {
        headers: header,
        method: 'POST',
        body: dataToSend,
      });
      const data = await response.json();

      this.hspUpdatePayload(data);
    }

    callback(null);
  }

  getWeekProgrammOn(callback: CharacteristicGetCallback) {
    const isOn = this.msg.payload.weekProgramStart;
    

    this.platform.log.debug('Get WeekProgrammStart On ->', isOn);
    
    callback(null, isOn);
  }

  async setEcoModeOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    
    if(this.msg.payload.weekProgramStart !== value as boolean){
      this.msg.payload.ecoMode = value as boolean;

      this.platform.log.debug('Set Eco-Mode On ->', value);
    
      const nonce = await this.hspGetNonce();
      //this.platform.log.debug("nonce: ",nonce);

      const hash = this.hspCalculatePin(nonce, this.platform.config.pin as string);
      
      const setData = {};
      setData['eco_mode'] = value as boolean;

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url, hash);
      
      const response = await fetch(`http://${this.url}/status.cgi`, {
        headers: header,
        method: 'POST',
        body: dataToSend,
      });
      const data = await response.json();

      this.hspUpdatePayload(data);
    }

    callback(null);
  }

  getEcoModeOn(callback: CharacteristicGetCallback) {
    const isOn = this.msg.payload.ecoMode;

    this.platform.log.debug('Get Eco-Mode On ->', isOn);
    callback(null, isOn);
  }


  async setRunningOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to turn your device on/off
    if(this.msg.payload.start !== value as boolean){
      this.msg.payload.start = value as boolean;

      this.platform.log.debug('Set Running On ->', value);
    
      const nonce = await this.hspGetNonce();
      //this.platform.log.debug("nonce: ",nonce);

      const hash = this.hspCalculatePin(nonce, this.platform.config.pin as string);
      
      const setData = {};
      setData['prg'] = value as boolean;

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url, hash);
      
      const response = await fetch(`http://${this.url}/status.cgi`, {
        headers: header,
        method: 'POST',
        body: dataToSend,
      });
      const data = await response.json();

      this.hspUpdatePayload(data);
    }
    callback(null);
  }

  getRunningOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.msg.payload.start;

    this.platform.log.debug('Get Running Running On ->', isOn);

    
    callback(null, isOn);
  }

  setStateBrightness(value: CharacteristicValue, callback) {

    this.platform.log.debug('Cannot set state with homekit');


    callback(1);
  }

  private getHeatingState(){
    switch(this.msg.payload.mode){
      
      case 'start':
        if(this.msg.payload.zone !== undefined){
          this.state.Brightness = (95.0/20.0) * this.msg.payload.zone as number;
        } else {
          this.state.Brightness = 11;
        }
        this.state.Cooling = 100;
        break;
      case 'heating':
        this.state.Brightness = 100;
        break;
      case 'cooling':
        this.state.Cooling -= 1; 
        this.state.Cooling = this.state.Cooling>0 ? this.state.Cooling : 1;
        this.state.Brightness = this.state.Cooling;
        break;
      
      case 'standby':
      default:
        this.state.Brightness = 0;
        this.state.Cooling = 0;
        break;

    }

    this.platform.log.debug('HEATING STATE: ', this.msg.payload.mode, this.msg.payload.zone, Math.round(this.state.Brightness)); 
    return Math.round(this.state.Brightness);
  }

  getStateBrightness(callback: CharacteristicGetCallback) {
    
    callback(null, this.getHeatingState());
  }

  setState(value, callback) {

    this.platform.log.debug('Cannot set state with homekit');

    callback(1);
  }

  getState(callback: CharacteristicGetCallback) {
    callback(null, this.getHeatingState()>0 ? 1 : 0);
  }

  getActualTemperature(callback: CharacteristicGetCallback) {
    callback(null, this.msg.payload.isTemp);
  }

  handleConfiguredNameGet(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET ConfiguredName');

    // set this to a valid value for ConfiguredName
    const currentValue = this.msg.payload.setTemp.toString();

    callback(null, currentValue);
  }

  async handleConfiguredNameSet(value, callback: CharacteristicSetCallback) {
    this.platform.log.debug('Triggered SET ConfiguredName:', value);

    if(Number.isInteger(parseInt(value)) && this.msg.payload.setTemp !== value as number && value as number > 15){
      this.msg.payload.setTemp = value as number;
      this.platform.log.debug('Set Temperature On ->', value as number);
      
      const nonce = await this.hspGetNonce();
      
      const hash = this.hspCalculatePin(nonce, this.platform.config.pin as string);
      
      const setData = {};
      setData['sp_temp'] = parseInt(value);

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url, hash);
      
      const response = await fetch(`http://${this.url}/status.cgi`, {
        headers: header,
        method: 'POST',
        body: dataToSend,
      });
      const data = await response.json();

      this.hspUpdatePayload(data);


      callback(null);
    } else {
      callback(new Error('Input is not a correct number.'));
    }
  }

  handleInputSourceTypeGet(callback) {
    callback(null, this.platform.Characteristic.InputSourceType.OTHER);
  }


  handleIsConfiguredGet(callback) {
    callback(null, this.platform.Characteristic.IsConfigured.CONFIGURED);
  }

  handleNameGet(callback) {
    this.platform.log.debug('Triggered GET Name');

    const currentValue = 'Soll-Temperature';

    callback(null, currentValue);
  }

  handleCurrentVisibilityStateGet(callback) {
    this.platform.log.debug('Triggered GET CurrentVisibilityState');

    const currentValue = 1;

    callback(null, currentValue);
  }

  handleFilterChangeIndicationGet(callback) {
    this.platform.log.debug('Triggered GET FilterChangeIndication');

    const currentValue = 1;

    callback(null, currentValue);
  }



  /**
   * HSP POST functions
   */
  private hspUpdatePayload(data){
    this.msg.payload = {
      start: data.prg,
      weekProgramStart: data.wprg,
      mode: data.mode,
      isTemp: data.is_temp,
      setTemp: data.sp_temp,
      ecoMode: data.eco_mode,
      nonce: data.meta.nonce,
      error: data.error.length <= 0 ? false : data.error,
      meta: {
        softwareVersion: data.meta.sw_version,
        language: data.meta.language,
        type: data.meta.typ,
        serialNumber: data.meta.sn,
      },
      pgi: data.pgi,
      ignitions: data.ignitions,
      onTime: data.on_time,
      consumption: data.consumption,
      maintenance: data.maintenance_in,
      cleaning: data.cleaning_in,
      zone: data.zone,
    };
  }

  private async hspGetNonce(){
    const response = await fetch(`http://${this.url}/status.cgi`);
    const data = await response.json();
    return data.meta.nonce;
  }

  private hspCalculatePin(nonce: string, pin: string) {
    return md5(nonce+md5(pin));
  }

  private hspCreateRequestHeader(url: string, hash: string){
    return new Headers({
      'Host':	url,
      'Accept':	'*/*',
      'Proxy-Connection':	'keep-alive',
      'X-BACKEND-IP':	'https://app.hsp.com',
      'Accept-Language': 'de-DE;q=1.0, en-DE;q=0.9',
      'Accept-Encoding': 'gzip;q=1.0, compress;q=0.5',
      'token': '32bytes',
      'Content-Type': 'application/json',
      'User-Agent': 'ios',
      'Connection':	'keep-alive',
      'X-HS-PIN': hash,
    });
  }
  
}
