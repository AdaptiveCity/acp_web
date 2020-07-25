"use strict"

class SpaceRenderMap {

    constructor() {
        this.map;
    }

    init() {
        this.draw_site(this);
    }

    initMap(results) {

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

        var spider = L.markerClusterGroup();

        var markers = results['sensors']
        for (var i = 0; i < markers.length; ++i) {
            var marker = L.marker(new L.LatLng(markers[i].acp_lat, markers[i].acp_lng), {
                title: markers[i].sensor
            });

            marker.bindPopup(markers[i].sensor);
            spider.addLayer(marker);
        }

        this.map.addLayer(spider);

        //this.draw_wgb(this);

        //DEBUG map_visualisation.js we want to get all the 'building' objects and iterate
        this.get_bim_crate('WGB');

        this.get_bim_crate('lockdown_lab');

        this.get_bim_crate('IFM')

    }

    // Use BIM api to get data for crate
    get_bim_crate(crate_id){
        console.log("Getting boundary for "+crate_id);
        self = this;
        var request = new XMLHttpRequest();
        request.overrideMimeType('application/json');

        request.addEventListener("load", function () {
            var crates = JSON.parse(request.responseText)
            console.log("get_bim_crate() returned:",crates);
            // Note the BIM api returns a list
            self.handle_bim_crate(self, crates[0]);
        });
        let api_url = API_BIM+"get_gps/"+crate_id+"/0/";
        console.log("get_bim_crate() requesting "+api_url);
        request.open("GET", api_url);
        request.send();
    }

    handle_bim_crate(self, crate) {
        self.draw_crate(self, crate);
    }

    draw_crate(self, crate) {
        var crate_id = crate['crate_id'];
        console.log("draw_crate",crate["crate_id"]);
        for (var i in crate["acp_boundary_gps"]) {
            var boundary = crate["acp_boundary_gps"][i];
            var latlngs = boundary["boundary"];
                self.draw_boundary(self, crate_id, latlngs, boundary["boundary_type"]);
        }
    }

    draw_boundary(self, crate_id, latlngs, boundary_type) {
        var color = boundary_type == "boundary" ? 'red' : 'yellow'
        var polygon = L.polygon(latlngs, {color: color, weight: 1});
        if (boundary_type == "boundary") {
            polygon.on({
                'mouseover': self.highlight,
                'mouseout': self.normal,
                'click': function (e) { self.building_page(crate_id) }
            });
        }
        polygon.addTo(self.map);
    }

    building_page(crate_id){
        // URL_BUILDING is set in the map.html template
        window.location = URL_BUILDING.replace('crate_id',crate_id);
    }

    highlight(e) {
        var layer = e.target;
        layer.setStyle({
            color: 'blue',
            opacity: 1,
            weight: 5
        });
    }

    normal(e) {
        var layer = e.target;
        layer.setStyle({
            color: 'red',
            opacity: 1,
            weight: 1
        });
    }

    findLatLng() {
        this.map.on('click',
            function (e) {
                var coord = e.latlng.toString().split(',');
                var lat = coord[0].split('(');
                var lng = coord[1].split(')');
                console.log(lat[1] + "," + lng[0]);
            });
    }

    draw_site(parent) {

        var url = API_SENSORS + 'get_gps/';

        console.log('fetching', url);

        d3.json(url, {
            crossOrigin: "anonymous"
        }).then(function (received_data) {

            parent.initMap(received_data);
            parent.findLatLng();

        });
    }

} // end class SpaceRenderMap
