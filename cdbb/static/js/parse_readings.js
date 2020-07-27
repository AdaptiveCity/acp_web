"use strict"

// js/parse_readings.js
//
// Uses "js/jsonpath.js" - provides e.g. jsonPath(reading_jsonobject, "$.acp_id")

class ParseReadings {

    constructor() {
        console.log("ParseReadings instantiated.");
    }

    init() {
        console.log("ParseReadings init")
    }

    parse_reading(reading, sensor_metadata) {
        let features = sensor_metadata["acp_type_info"]["features"];
        // Build 'reading_obj' to return e.g. { "co2": { "name": "CO2 (ppb)", value: "413.7" }, ... }
        let reading_obj = {}
        for (const [feature_id, feature_obj] of Object.entries(features)) {
            reading_obj[feature_id] = { "name": feature_obj["name"],
                                        "value": jsonPath(reading, feature_obj['jsonpath'])
                                      }
        }
        return reading_obj;
    }

} // end class ParseReadings
