
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# homebridge-hsp

This is a homebridge plugin to control a Haas+Sohn pellet stoves like the HSP 2.17 Home II via the [HomeBridge Platform](https://github.com/nfarina/homebridge).
It has been implemented to be used with [Hoobs](https://hoobs.org/) as a plugin.

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install homebridge-octoprint using: npm install -g homebridge-hsp
3. Update your configuration file. See sample-config.json in this repository for a sample or below.


```
"platforms": [{
    "platform":"HspHomebridgePlugin",
    "name":"HSP-2.17 II Home",
    "host":"192.168.0.1",
    "pin":"1234",
    "interval":60,
    "type":"HSP-1/2",
    "serial":"1234567"
}]
```

# What does this plugin do?
This plugin adds a new platform to Homekit. Inside the platform it shows serval services:
1. the actual temperature around the stove
2. a switch to start/stop 
3. a switch to start/stop the weekprogramm
4. a switch to run in Eco-Mode
5. a lightbulb that represents the heating process (Standby, Starting-Zones 1-20: 0-90%, Heating 100%, Cooling 100-0% counting down)
6. an input source that give you the possiblity to set a certain temperatur (actullay not working! It only shows the temperature set, but editing changes nothing yet)

## Additionally there are some extra features planed:
a. Cleaning countdown/filtermaintenance: shows the time left for cleaning the stove (every 20h! with this model)
b. Maintenance countdown/filtermaintenance: shows the kilograms left for making a big maintenance (every 1000kg with this model)

# Notes for implementation

## Possible Characteristics and Services
This plugin has been created based on the [homebridge-plugin-template](https://github.com/homebridge/homebridge-plugin-template).
Description of characteristics (available methods and how to build listener) can be found in the [Homebridge-API](https://developers.homebridge.io/#/)

## Start in Developer Mode

To start the plugin in developer mode run `homebridge -D -P . -U ~/.homebridge-dev/` while beeing in the root directory. A sample config has to be saved at `~/.homebridge-dev/`.