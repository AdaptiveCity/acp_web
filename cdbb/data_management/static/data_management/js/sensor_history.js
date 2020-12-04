"use strict"

class SensorHistory {

    constructor() {
        console.log("sensor.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.sensor_history_el = document.getElementById('sensor_history');
        parent.handle_sensor_history(parent)
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_history(parent) {
        console.log("handle_sensor_history");

        let sensor_history_el = document.getElementById('sensor_history');

        let sensor_info_el = document.createElement('div');
        sensor_info_el.innerText = API_SENSOR_INFO['acp_ts'];
        sensor_history_el.appendChild(sensor_info_el);

        for (let sensor_info of API_SENSOR_HISTORY) {
            let sensor_info_el = document.createElement('div');
            sensor_info_el.innerText = sensor_info['acp_ts'];
            sensor_history_el.appendChild(sensor_info_el);
        }
    }

    escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
          tag => ({
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;',
              "'": '&#39;',
              '"': '&quot;'
            }[tag]));
    }

} // end class SensorHistory
