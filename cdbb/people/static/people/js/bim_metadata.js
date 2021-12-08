"use strict"

class BIMMetadata {

    constructor() {
        console.log("bim_metadata.js loading...");
    }

    init() {
        parent = this;
        console.log("init()");
        parent.metadata_el = document.getElementById('metadata');
        parent.handle_bim_metadata(parent, API_BIM_CRATE_INFO);
    }

    // Will handle the return jsonobject from the BIM API request
    handle_bim_metadata(parent, metadata) {
        console.log("handle_bim_metadata got", metadata);

        // Display the Metadata jsonobject
        let metadata_txt = JSON.stringify(metadata, null, 2);
        let metadata_content_el = document.createElement('pre');
        metadata_content_el.id = 'metadata_content';
        metadata_content_el.innerHTML = this.escapeHTML(metadata_txt);
        parent.metadata_el.appendChild(metadata_content_el);

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

} // end class BIMMetadata
