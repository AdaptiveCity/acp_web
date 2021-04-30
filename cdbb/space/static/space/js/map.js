"use strict"

// Template provides global vars:
//      API_BIM  -- Building Information API base
//      API_SENSORS -- Sensors metadata API base
//      BUILDING_LINK -- links to building page, e.g. /space/building/crate_id/
//      SENSOR_LINK -- links to sensor page, e.g. /sensor/sensor/acp_id/

class SpaceRenderMap {

    constructor() {
        this.map;
    }

    init() {

        // Display the map, with chosen settings
        this.init_map();

        // Set up a function to be called if the map is clicked
        // Currently writes lat/lng of click to js console.
        this.init_map_click();

        // Note the code is 'async' from here, both of these functions will do XMLHttpRequests
        this.handle_gps_sensors(API_SENSOR_INFO);
        this.handle_bim_crates(this);
    }

    // Display the map, not yet populated with sensors / buildings.
    init_map() {

        var stamenToner = L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
            attribution: 'Map tiles by Stamen Design, CC BY 3.0 - Map data © OpenStreetMap',
            subdomains: 'abcd',
            minZoom: 0,
            maxZoom: 20,
            ext: 'png'
        });

        var cambridge = new L.LatLng(52.21, 0.087);
        this.map = new L.Map("map", {
            center: cambridge,
            zoom: 16,
            layers: [stamenToner],
        });


        var info_widget = L.control();

        info_widget.onAdd = function (map) {
            this.info_div = L.DomUtil.create('div', 'info'); //has to be of class "info for the nice shade effect"
            this.update();

            return this.info_div;
        };

        info_widget.update = function (e) {
            if (e === undefined) {
                this.info_div.innerHTML =
                    '<h4>Map view of West Cambridge</h4>'
                return;
            }
        };

        info_widget.addTo(this.map);

        this.markers_layer = L.markerClusterGroup();

        this.map.addLayer(this.markers_layer);
    }

    handle_bim_crates(parent, crate) {
        for (const crate_id in API_BIM_INFO) {
            parent.draw_crate(parent, API_BIM_INFO[crate_id]);
        }
    }

    draw_crate(parent, crate) {
        var crate_id = crate['crate_id'];
        console.log("draw_crate",crate["crate_id"]);
        for (var i in crate["acp_boundary_gps"]) {
            var boundary = crate["acp_boundary_gps"][i];
            var latlngs = boundary["boundary"];
                parent.draw_boundary(parent, crate_id, latlngs, boundary["boundary_type"]);
        }
    }

    draw_boundary(parent, crate_id, latlngs, boundary_type) {
        var color = boundary_type == "boundary" ? 'red' : 'yellow'
        var polygon = L.polygon(latlngs, {color: color, weight: 1});
        if (boundary_type == "boundary") {
            polygon.on({
                'mouseover': parent.highlight_boundary,
                'mouseout': parent.normal_boundary,
                'click': function (e) { parent.building_page(crate_id) }
            });
        }
        polygon.addTo(parent.map);
    }

    // Trigger the browser to move to our 'building' page.
    building_page(crate_id){
        // BUILDING_LINK is set in the map.html template e.g. "/space/building/crate_id/"
        // Note we **replace** the "crate_id" string with the actual required id. This is the most straightforward
        // way to have Django provide 'template' urls with this Javascript being robust as the API structure
        // evolves during development.
        window.location = BUILDING_LINK.replace('crate_id',crate_id);
    }

    // Change building boundary color on mouseover
    highlight_boundary(e) {
        var layer = e.target;
        layer.setStyle({
            color: 'blue',
            opacity: 1,
            weight: 5
        });
    }

    normal_boundary(e) {
        var layer = e.target;
        layer.setStyle({
            color: 'red',
            opacity: 1,
            weight: 1
        });
    }

    // Set up function to handle a click on the map
    // Currently writes lat/lng to the console
    init_map_click() {
        this.map.on('click',
            function (e) {
                var coord = e.latlng.toString().split(',');
                var lat = coord[0].split('(');
                var lng = coord[1].split(')');
                console.log(lat[1] + "," + lng[0]);
            });
    }

    handle_gps_sensors(gps_sensors) {
        var sensors = gps_sensors['sensors']
        for (var acp_id in sensors) {
            let sensor = sensors[acp_id];
            console.log("handle_gps_sensors() adding ",sensors[acp_id]);
            let marker = L.marker(new L.LatLng(sensor.acp_location.lat,
                                               sensor.acp_location.lng),
                                               { title: sensor.acp_id }
            );

            // See 'building_page()' above for which we use these tweakable links from Django
            let popup_html = '<a href="'+SENSOR_LINK.replace('acp_id',acp_id)+'">'+acp_id+'</a>';
            if ('description' in sensor) {
                popup_html += '<br/>'+sensor['description'];
            }
            marker.bindPopup(popup_html);
            this.markers_layer.addLayer(marker);
        }
    }

} // end class SpaceRenderMap
