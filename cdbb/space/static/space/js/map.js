"use strict"

class SpaceRenderMap {

    constructor() {
        this.map;
        //DEBUG this needs to change for django
        this.baseurl='/wgb/building/'
    }

    init() {
        this.draw_site(this);
    }

    initMap(results) {

        var stamenToner = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png', {
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

        //#DEBUG map_visualisation.js we want to get all the 'building' objects and iterate
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
            console.log("get_bim_crate returned:",crates);
            // Note the BIM api returns a list
            self.handle_bim_crate(self, crates[0]);
        });
        request.open("GET", API_BIM+"get_gps/"+crate_id+"/0");
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
        window.location = 'building/'+crate_id;
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

    // Draw the building on the map
    draw_wgb_svg(parent) {

        let wgb_a = [52.2105, 0.09133] //[52.210499, 0.091332]
        let wgb_b = [52.2114, 0.09274] //[52.211359, 0.092735]

        let wgb_url = '/api/space/get/bim/WGB/0'; //API_SPACE + 'get/bim/WGB/0';

        d3.svg(wgb_url, {
            crossOrigin: "anonymous"
        }).then(function (xml) {

            var wgb_svg_data = xml.getElementsByTagName("polygon")[0];

            wgb_bounds = [wgb_a, wgb_b];
            var wgb_svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            wgb_svg.setAttribute('xmlns', "http://www.w3.org/2000/svg");
            wgb_svg.setAttribute("viewBox", "0 0 600 600");
            wgb_svg.appendChild(wgb_svg_data);
            wgb_svg.setAttribute('id', 'wgb_svg')
            var wgb_bounds = [wgb_a, wgb_b];
            L.svgOverlay(wgb_svg, wgb_bounds, {
                interactive: true
            }).addTo(parent.map);

            d3.selectAll('#WGB').style('fill', 'red').attr('transform', 'scale(0.77), rotate(15), translate(130,-50)');

            d3.selectAll("#ifm,#WGB").style("fill", "red")
            .on("mouseover", function (d) {
                d3.select(this).transition().duration(300).style("fill", "yellow")
            })
            .on("mouseout", function (d) {
                d3.select(this).transition().duration(300).style("fill", "red")
            })
            .on("click", function (d, i) {
                window.location = parent.baseurl + this.id; //, '_blank')
            })

        });
    }

    // Draw the IfM building on the map
    draw_ifm(parent) {
        let ifm_a = [52.209147, 0.086865]
        let ifm_b = [52.209759, 0.087799]
        var ifm_svg_data = '<path id="ifm" class="st0" d="M42.4,0.1L0.1,333.6l288.3,36.5l42.2-333.5L42.4,0.1z M221.4,198.1l-107.7-13.6l14.2-112.2L235.6,86	L221.4,198.1z"/></svg>'
        var svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
        svgElement.setAttribute("viewBox", "0 0 330.8 370.2");
        svgElement.innerHTML = ifm_svg_data;

        d3.selectAll('#WGB').style('fill', 'red').attr('transform', 'scale(0.77), rotate(15), translate(130,-50)');


        var svgElementBounds = [ifm_a, ifm_b];
        L.svgOverlay(svgElement, svgElementBounds, {
            interactive: true
        }).addTo(parent.map);

        d3.selectAll('#WGB').style('fill', 'red').attr('transform', 'scale(0.77), rotate(15), translate(130,-50)');

        d3.selectAll("#ifm,#WGB").style("fill", "red")
            .on("mouseover", function (d) {
                d3.select(this).transition().duration(300).style("fill", "yellow")
            })
            .on("mouseout", function (d) {
                d3.select(this).transition().duration(300).style("fill", "red")
            })
            .on("click", function (d, i) {
                window.open(baseurl + this.id);//, '_blank')
            })
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

    addBuilding(){
        return
    }

    draw_site(parent) {

        var url = API_SENSORS + 'get_gps';

        console.log('fetching', url);

        d3.json(url, {
            crossOrigin: "anonymous"
        }).then(function (received_data) {

            parent.initMap(received_data);
            parent.findLatLng();

        });
    }

} // end class SpaceRenderMap
