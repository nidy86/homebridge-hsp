import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { HspHomebridgePlatform } from './platform';

import { Headers } from 'node-fetch';
import fetch from 'node-fetch';
import md5 from 'md5';


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export default class HspPlatformAccessory {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    On: false,
    Brightness: 0,
    Cooling: 100
  }

  private url = "localhost";

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
            serialNumber: '0000000'
        },
        ignitions: -1,
        onTime: -1,
        consumption: -1,
        maintenance: -1,
        cleaning: -1,
        zone: 0
    }
  };

  constructor(
    private readonly platform: HspHomebridgePlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Haas+Sohn')
      .setCharacteristic(this.platform.Characteristic.Model, this.platform.config.type as string)//'HSP 2.17 Home II')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, this.platform.config.serial as string);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, 'Ofen eingeschalten');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setRunningOn.bind(this))
      .on('get', this.getRunningOn.bind(this));

    // register handlers for the Brightness Characteristic
    /*this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below
*/

    /**
     * Creating multiple services of the same type.
     * 
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     * 
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    /*const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
      this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');*/

    const temperatureActualService = this.accessory.getService('Raumtemperatur') ||
      this.accessory.addService(this.platform.Service.TemperatureSensor,'Raumtemperatur',this.platform.api.hap.uuid.generate('HSP-isTemp'));
    
    //const temperatureSetService = this.accessory.getService('Solltemperatur') ||
    //  this.accessory.addService(this.platform.Service.TemperatureSensor,'Solltemperatur',this.platform.api.hap.uuid.generate('HSP-setTemp'));

    const filterMaintenance = this.accessory.getService("Filter") ||
      this.accessory.addService(this.platform.Service.FilterMaintenance,"Filter",this.platform.api.hap.uuid.generate('HSP-filter'));

    filterMaintenance.getCharacteristic(this.platform.Characteristic.FilterChangeIndication)
      .on('get',this.handleFilterChangeIndicationGet.bind(this));
    const stateService = this.accessory.getService('Status') ||
      this.accessory.addService(this.platform.Service.Lightbulb,'Status',this.platform.api.hap.uuid.generate('HSP-state'));

    stateService.getCharacteristic(this.platform.Characteristic.Brightness)
      .on('set', this.setStateBrightness.bind(this))
      .on('get', this.getStateBrightness.bind(this));

    stateService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setState.bind(this))
      .on('get', this.getState.bind(this));
    

    const weekProgrammService = this.accessory.getService('Wochenprogramm') ||
      this.accessory.addService(this.platform.Service.Switch,'Wochenprogramm',this.platform.api.hap.uuid.generate('HSP-weekProgrammStart'));

    weekProgrammService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setWeekProgrammOn.bind(this))
      .on('get', this.getWeekProgrammOn.bind(this));

    
    const ecoModeService = this.accessory.getService('Eco-Mode') ||
      this.accessory.addService(this.platform.Service.Switch,'Eco-Mode',this.platform.api.hap.uuid.generate('HSP-ecoMode'));

    ecoModeService.getCharacteristic(this.platform.Characteristic.On)
      .on('set', this.setEcoModeOn.bind(this))
      .on('get', this.getEcoModeOn.bind(this));




    const inputSetTemperature = this.accessory.getService('Solltemperatur') ||
      this.accessory.addService(this.platform.Service.InputSource,'Solltemperatur',this.platform.api.hap.uuid.generate('HSP-setTemp'));

    inputSetTemperature.getCharacteristic(this.platform.Characteristic.ConfiguredName)
      .on('get', this.handleConfiguredNameGet.bind(this))
      .on('set', this.handleConfiguredNameSet.bind(this));

    inputSetTemperature.getCharacteristic(this.platform.Characteristic.InputSourceType)
      .on('get', this.handleInputSourceTypeGet.bind(this));

    inputSetTemperature.getCharacteristic(this.platform.Characteristic.IsConfigured)
      .on('get', this.handleIsConfiguredGet.bind(this));

    inputSetTemperature.getCharacteristic(this.platform.Characteristic.Name)
      .on('get', this.handleNameGet.bind(this));

    inputSetTemperature.getCharacteristic(this.platform.Characteristic.CurrentVisibilityState)
      .on('get', this.handleCurrentVisibilityStateGet.bind(this));
      
    
    /**
     * TEST Section: Define
     */
    
    
    /**
     * Updating characteristics values asynchronously.
     * 
     */
    this.url = this.platform.config.host as string;
    let interval = (this.platform.config.interval as number)*1000 || 60000;

    let configDetails = false;
    setInterval(async () => {

      let response = await fetch(`http://${this.url}/status.cgi`);
      let data = await response.json();

      //let changed = this.msg.payload.weekProgramStart!=data.wprg;
      //this.platform.log.debug('Weekprogramm changed',changed);


      this.hspUpdatePayload(data);
      //this.platform.log.debug('response:',this.msg.payload);

      // push the new value to HomeKit
      temperatureActualService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature,this.msg.payload.isTemp.toFixed(1));
      //temperatureSetService.updateCharacteristic(this.platform.Characteristic.CurrentTemperature,this.msg.payload.setTemp);
      inputSetTemperature.updateCharacteristic(this.platform.Characteristic.InputSourceType.ConfiguredName,this.msg.payload.setTemp.toFixed(1));

      //if(changed){
      this.service.updateCharacteristic(this.platform.Characteristic.On,this.msg.payload.start);
      weekProgrammService.updateCharacteristic(this.platform.Characteristic.On,this.msg.payload.weekProgramStart);
      ecoModeService.updateCharacteristic(this.platform.Characteristic.On,this.msg.payload.ecoMode);

      stateService.updateCharacteristic(this.platform.Characteristic.Brightness,this.getHeatingState());
      filterMaintenance.updateCharacteristic(this.platform.Characteristic.FilterChangeIndication,1);
      //}

      

      this.platform.log.debug('Temperature (ACTUAL):', this.msg.payload.isTemp.toFixed(1));
      this.platform.log.debug('Temperature (SET):', this.msg.payload.setTemp.toFixed(1));
    }, interval);
  }
  

  async setWeekProgrammOn(value: CharacteristicValue, callback: CharacteristicSetCallback){
    if(this.msg.payload.weekProgramStart != value as boolean){
      this.msg.payload.weekProgramStart = value as boolean;
      this.platform.log.debug('Set WeekProgrammStart On ->', value);
    
      let nonce = await this.hspGetNonce();
      //this.platform.log.debug("nonce: ",nonce);

      let hash = this.hspCalculatePin(nonce,this.platform.config.pin as string);
      
      const setData = {};
            setData['wprg'] = value as boolean;

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url,hash)
      
      let response = await fetch(`http://${this.url}/status.cgi`, {
          headers: header,
          method: 'POST',
          body: dataToSend
      });
      let data = await response.json();

      this.hspUpdatePayload(data);
    }

    callback(null);
  }

  getWeekProgrammOn(callback: CharacteristicGetCallback) {
    const isOn = this.msg.payload.weekProgramStart;
    

    this.platform.log.debug('Get WeekProgrammStart On ->', isOn);
    

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  async setEcoModeOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    
    if(this.msg.payload.weekProgramStart != value as boolean){
      this.msg.payload.ecoMode = value as boolean;

      this.platform.log.debug('Set Eco-Mode On ->', value);
    
      let nonce = await this.hspGetNonce();
      //this.platform.log.debug("nonce: ",nonce);

      let hash = this.hspCalculatePin(nonce,this.platform.config.pin as string);
      
      const setData = {};
            setData['eco_mode'] = value as boolean;

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url,hash)
      
      let response = await fetch(`http://${this.url}/status.cgi`, {
          headers: header,
          method: 'POST',
          body: dataToSend
      });
      let data = await response.json();

      this.hspUpdatePayload(data);
    }

    callback(null);
  }

  getEcoModeOn(callback: CharacteristicGetCallback) {
    const isOn = this.msg.payload.ecoMode;

    this.platform.log.debug('Get Eco-Mode On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setRunningOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to turn your device on/off
    if(this.msg.payload.start != value as boolean){
      this.msg.payload.start = value as boolean;

      this.platform.log.debug('Set Running On ->', value);
    
      let nonce = await this.hspGetNonce();
      //this.platform.log.debug("nonce: ",nonce);

      let hash = this.hspCalculatePin(nonce,this.platform.config.pin as string);
      
      const setData = {};
            setData['prg'] = value as boolean;

      const dataToSend = JSON.stringify(setData);
      const header = this.hspCreateRequestHeader(this.url,hash)
      
      let response = await fetch(`http://${this.url}/status.cgi`, {
          headers: header,
          method: 'POST',
          body: dataToSend
      });
      let data = await response.json();

      this.hspUpdatePayload(data);
    }
    callback(null);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getRunningOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.msg.payload.start;

    this.platform.log.debug('Get Running Running On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  setStateBrightness(value: CharacteristicValue, callback) {

    this.platform.log.debug('Cannot set state with homekit');


    callback(1);
  }

  private getHeatingState(){
    switch(this.msg.payload.mode){
      
      case "start":
        if(this.msg.payload.zone !== undefined){
          this.state.Brightness = (95.0/20.0) * this.msg.payload.zone as number;
        } else {
          this.state.Brightness = 11;
        }
        this.state.Cooling = 100;
        break;
      case "heating":
        this.state.Brightness = 100;
        break;
      case "cooling":
        this.state.Cooling -= 1; 
        this.state.Cooling = this.state.Cooling>0 ? this.state.Cooling : 1;
        this.state.Brightness = this.state.Cooling;
        break;
      
      case "standby":
      default:
        this.state.Brightness = 0;
        this.state.Cooling = 0;
        break;

    }

    this.platform.log.debug('HEATING STATE: ',this.msg.payload.mode,this.msg.payload.zone,Math.round(this.state.Brightness)); 
    return Math.round(this.state.Brightness);
  }
  getStateBrightness(callback: CharacteristicGetCallback) {
    
    callback(null,this.getHeatingState());
  }

  setState(value, callback) {

    this.platform.log.debug('Cannot set state with homekit');

    callback(1);
  }

  getState(callback: CharacteristicGetCallback) {
    callback(null,this.getHeatingState()>0 ? 1 : 0);
  }

  /**
   * Handle requests to get the current value of the "Configured Name" characteristic
   */
  handleConfiguredNameGet(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET ConfiguredName');

    // set this to a valid value for ConfiguredName
    const currentValue = this.msg.payload.setTemp.toString();

    callback(null, currentValue);
  }

  /**
   * Handle requests to set the "Configured Name" characteristic
   */
  async handleConfiguredNameSet(value, callback: CharacteristicSetCallback) {
    this.platform.log.debug('Triggered SET ConfiguredName:', value);

    if(Number.isInteger(parseInt(value)) && this.msg.payload.setTemp != value as number && value as number > 15){
      this.msg.payload.setTemp = value as number;
      this.platform.log.debug('Set Temperature On ->', value as number);
      
        let nonce = await this.hspGetNonce();
        
        let hash = this.hspCalculatePin(nonce,this.platform.config.pin as string);
        
        const setData = {};
              setData['sp_temp'] = value as number;

        const dataToSend = JSON.stringify(setData);
        const header = this.hspCreateRequestHeader(this.url,hash)
        
        let response = await fetch(`http://${this.url}/status.cgi`, {
            headers: header,
            method: 'POST',
            body: dataToSend
        });
        let data = await response.json();

        //this.platform.log.debug("response: ",data);
        this.hspUpdatePayload(data);


      callback(null);
    } else {
      callback(new Error("Input is not a correct number."));
    }
  }

  /**
   * Handle requests to get the current value of the "Input Source Type" characteristic
   */
  handleInputSourceTypeGet(callback) {
    callback(null, this.platform.Characteristic.InputSourceType.OTHER);
  }


  /**
   * Handle requests to get the current value of the "Is Configured" characteristic
   */
  handleIsConfiguredGet(callback) {
    callback(null, this.platform.Characteristic.IsConfigured.CONFIGURED);
  }

  
  /**
   * Handle requests to get the current value of the "Name" characteristic
   */
  handleNameGet(callback) {
    this.platform.log.debug('Triggered GET Name');

    // set this to a valid value for Name
    const currentValue = "NAME";

    callback(null, currentValue);
  }


  /**
   * Handle requests to get the current value of the "Current Visibility State" characteristic
   */
  handleCurrentVisibilityStateGet(callback) {
    this.platform.log.debug('Triggered GET CurrentVisibilityState');

    // set this to a valid value for CurrentVisibilityState
    const currentValue = 1;

    callback(null, currentValue);
  }

  handleFilterChangeIndicationGet(callback) {
    this.platform.log.debug('Triggered GET FilterChangeIndication');

    // set this to a valid value for FilterChangeIndication
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
          serialNumber: data.meta.sn
      },
      ignitions: data.ignitions,
      onTime: data.on_time,
      consumption: data.consumption,
      maintenance: data.maintenance_in,
      cleaning: data.cleaning_in,
      zone: data.zone
    };
  }

  private async hspGetNonce(){
    let response = await fetch(`http://${this.url}/status.cgi`);
    let data = await response.json();
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
