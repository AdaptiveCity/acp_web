"use strict"

class SensorTypeEdit {

    constructor() {
        console.log("sensor_type_edit.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.handle_sensor_type_metadata(parent, SENSOR_TYPE_METADATA);
    }

    // Will handle the return jsonobject from the sensors API request
    handle_sensor_type_metadata(parent, sensor_type_metadata) {
        console.log("sensor_type_edit handle_sensor_type_metadata got", sensor_type_metadata);

        this.init_edit(sensor_type_metadata);
    }

    // ***************************************
    // Initialize the edit box
    // ***************************************
    init_edit(sensor_type_metadata) {

        this.update_required(sensor_type_metadata);

        // Display the Sensor Metadata jsonobject
        let metadata_txt = JSON.stringify(sensor_type_metadata, null, 4);

        console.log(metadata_txt);
        this.edit_box_el = document.getElementById("edit_box");
        //let edit_html = metadata_txt.replace(/(\r\n|\n|\r)/gm, '<br/>');
        //this.edit_box.innerHTML = edit_html;
        this.edit_box_el.innerHTML = metadata_txt.replace(/</g,"&lt;");

        this.edit_form_el = document.getElementById("edit_form");
        let parent = this;

        this.plain_text_el = document.getElementById("plain_text_value");

        this.save_button_el = document.getElementById("save_button");
        this.save_button_el.onclick = function (e) { parent.save(parent); };

        this.cancel_button_el = document.getElementById("cancel_button");
        this.cancel_button_el.onclick = function (e) { parent.cancel(parent); };

        this.error_box_init(parent);

        this.highlight_acp_comment(this.edit_box);
    }

    // Add properties (e.g. "acp_commit") if they're not already in data
    update_required(sensor_type_metadata) {

        sensor_type_metadata["acp_ts"] = this.acp_ts_now();

        sensor_type_metadata["acp_commit"] = {
                "acp_person_id": ACP_PERSON_ID, // from template
                "acp_person_name": ACP_PERSON_NAME ? ACP_PERSON_NAME : "ADD YOUR FULL NAME",
                "comment": ""
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
    validate(parent, plain_text) {
        let required_paths = [
            "$.acp_commit",
            "$.acp_commit.comment",
            "$.acp_commit.acp_person_id",
            "$.acp_commit.acp_person_name",
            "$.acp_ts",
            "$.acp_type_id"
        ];

        console.log("validating");
        let metadata_obj = {};
        try {
            metadata_obj = JSON.parse(plain_text);
        } catch (e) {
            parent.error_box(parent, "Edit text is has JSON format errors.");
            return false;
        }

        for (let i in required_paths) {
            let path = required_paths[i];
            let p = jsonPath(metadata_obj, path);
            if (!p || p=='') {
                parent.error_box(parent, "missing "+path);
                return false;
            }
        }

        if (jsonPath(metadata_obj,"$.acp_type_id") != ACP_TYPE_ID) {
                parent.error_box(parent, "acp_type_id must be "+ACP_TYPE_ID);
                return false;
            }

        return true;
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

    // ******************************************************
    //         User has hit 'SAVE' button
    // ******************************************************
    save(parent) {
        console.log('user save');
        let plain_text = parent.edit_box_el.innerText;
        if (parent.validate(parent, plain_text)) {
            parent.plain_text_el.value = plain_text;
            parent.edit_form_el.submit();
        }
    }

    // ******************************************************
    //         User has hit 'CANCEL' button
    // ******************************************************
    cancel(parent) {
        console.log('user cancel');
        location.reload();
    }

    // ******************************************************
    //         Error box
    // ******************************************************

    error_box_init(parent) {
        parent.error_box_el = document.getElementById("error_box");
        parent.error_box_content_el = document.getElementById("error_box_content");

        let close_el = document.getElementById("error_box_close");
        close_el.onclick = function (e) { parent.error_box_close(parent); };
    }

    // Hide the error box div.
    error_box_close(parent) {
        parent.error_box_el.style.display = 'none';
    }

    error_box(parent, content) {
        parent.error_box_content_el.innerHTML = content;
        parent.error_box_el.style.display = 'flex';
    }

    // *********************
    // Utility functions
    // *********************

    // Return a millisecond acp_ts string for "now"
    acp_ts_now() {
        return (Date.now() / 1000).toFixed(3);
    }

} // end class SensorEdit
