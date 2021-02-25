"use strict"

class SensorEdit {

    constructor() {
        console.log("sensor_edit.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.handle_sensor_metadata(parent, SENSOR_METADATA);
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_metadata(parent, sensor_metadata) {
        console.log("sensor_edit handle_sensor_metadata got", sensor_metadata);

        // Delete the type info returned by the API
        delete sensor_metadata.acp_type_info;

        this.init_edit(sensor_metadata);
    }

    init_edit(sensor_metadata) {

        this.add_required(sensor_metadata);

        // Display the Sensor Metadata jsonobject
        let sensor_metadata_txt = JSON.stringify(sensor_metadata, null, 4);

        console.log(sensor_metadata_txt);
        this.edit_box = document.getElementById("edit_box");
        //let edit_html = sensor_metadata_txt.replace(/(\r\n|\n|\r)/gm, '<br/>');
        //this.edit_box.innerHTML = edit_html;
        this.edit_box.innerHTML = sensor_metadata_txt;

        this.highlight_acp_comment(this.edit_box);
    }

    // Add properties (e.g. "acp_commit") if they're not already in data
    add_required(sensor_metadata) {
        if (!sensor_metadata.hasOwnProperty('acp_commit')) {
            sensor_metadata["acp_commit"] = {
                "acp_person_id": ACP_PERSON_ID, // from template
                "acp_person_name": ACP_PERSON_NAME ? ACP_PERSON_NAME : "ADD YOUR FULL NAME",
                "comment": "COMMENT REQUIRED"
            }
        }
    }

    // With a selected area of the edit_box, apply formatting
    format_selected(format_command) {
        let range = window.getSelection().getRangeAt(0);
        this.format_range(format_command, range);
    }

    format_range(format_command, range) {
        const oldContent = document.createTextNode(range.toString());
        switch (format_command) {
            case "bold":
                const newElement = document.createElement('span');
                newElement.className = 'edit_bold';
                newElement.append(oldContent);
                range.deleteContents();
                range.insertNode(newElement);
                break;
            default:
                console.log("format_range bad ",format_command);
        }
    }

    highlight_acp_comment(el) {
        return;
        let range = new Range();
        res = document.evaluate("//text()[contains(.,'acp_commit')]", el, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        let node = res.singleNodeValue
        range.setStart(node,0);

    }

    // Remove all HTML and check the edit_box for bad JSON or missing required fields
    validate() {
        console.log("validating");
        return false;
    }

    // for debug purposes
    showHTML(checked) {
        if (checked) {
            let html_str = this.edit_box.innerHTML;
            let pre = document.createElement('pre');
            pre.innerText = html_str;
            this.edit_box.appendChild(pre);
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

} // end class SensorEdit
