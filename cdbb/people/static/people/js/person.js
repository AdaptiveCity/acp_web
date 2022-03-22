"use strict"

class Person {

    constructor() {
        console.log("person.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.person_content_el = document.getElementById('person_content');

        parent.handle_person_metadata(parent, PERSON_METADATA);
    }

    // Will handle the return jsonobject from the sensors API request
    handle_person_metadata(parent, person_metadata) {
        console.log("handle_person_metadata got", person_metadata);

        let inst_info  = {};
        // clone "acp_type_info" into its own jsonobject and remove from person_metadata
        try {
            inst_info = JSON.parse(JSON.stringify(person_metadata["inst_info"]));
        } catch (err) {
            console.log("handle_person_metadata parse error for inst_info");
        }
        delete person_metadata.inst_info;

        // Display the Sensor Metadata jsonobject
        let person_metadata_txt = JSON.stringify(person_metadata, null, 2);
        let person_el = document.createElement('pre');
        person_el.id = 'person_metadata';
        person_el.innerHTML = this.escapeHTML(person_metadata_txt);
        parent.person_content_el.appendChild(person_el);

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

} // end class Person
