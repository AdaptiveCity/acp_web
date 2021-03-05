"use strict"

// Template provides ACP_TYPE_ID, API_SENSORS

class SensorType {

    constructor() {
        console.log("sensor_type.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.type_info_el = document.getElementById('type_info');
        parent.get_type_info(parent);
    }

    // Use API_SENSORS to retrieve requested sensor metadata
    get_type_info(parent) {
        let type_info_url = API_SENSORS + 'get_type/' + ACP_TYPE_ID + '/';
        let request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
          let type_info = JSON.parse(request.responseText)
          parent.handle_type_info(parent, type_info);
        });
        console.log("sensor_type.js requesting "+type_info_url);
        request.open("GET", type_info_url);
        request.send();
    }

    // Will handle the return jsonobject from the sensors API request
    handle_type_info(parent, type_info) {
        console.log("handle_type_info got", type_info);

        // Display the Sensor Type jsononbject
        let type_txt = JSON.stringify(type_info, null, 2);
        parent.type_info_el.innerHTML = "<pre>" + this.escapeHTML(type_txt) + "</pre>";
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

} // end class SensorType
