const CONNECT_URL = 'https://tfc-app9.cl.cam.ac.uk/rtmonitor/A/mqtt_acp' //'https://tfc-app6.cl.cam.ac.uk/rtmonitor/A/mqtt_acp';
const CONNECT_MSG = {
    "msg_type": "rt_connect",
    "client_data": {
        "rt_client_name": "Socket Client",
        "rt_client_id": "socket_client",
        "rt_client_url": "https://tfc-app4.cl.cam.ac.uk/backdoor/socket-client/index.html",
        "rt_token": "888"
    }
};


const CONNECT_FILTER_ALL = {
    "msg_type": "rt_subscribe",
    "request_id": "abc",

};

const SENSOR_LIST = ["elsys-co2-041ba8", "elsys-co2-041ba9", "elsys-co2-041baa", "elsys-co2-0460ec", "elsys-co2-0461e4", "elsys-co2-0461e6", "elsys-co2-0461e7", "elsys-ems-048f2b", "elsys-eye-044501", "ijl20-co2-0366b0"];

var CONNECT_FILTER = {
    "msg_type": "rt_subscribe",
    "request_id": "abc",
    "filters": [{
        "key": "acp_id",
        "test": "in",
        "values": SENSOR_LIST
    }]
};
var socket;

var history_key = "socket_client_send_history";
var send_history = [];
var send_history_cursor = 0;

// d3.selection.prototype.finish = function() {
//     var slots = this.node().__transition;
//     var keys = Object.keys(slots);
//     keys.forEach(function(d,i) {
//       if(slots[d]) slots[d].timer._call(); 
//     })	
//   }

const CIRCLE_RADIUS = 0.5;

class RTmonitor {
    constructor(sub_list) {
        if (sub_list == undefined) {
            this.sub_list = SENSOR_LIST
        } else {
            this.sub_list = sub_list;
            CONNECT_FILTER['filters']['values'] = this.sub_list;
        }


        //counts the numbre of times each asp_id has been triggered
        //e.g. [{'acp_id':zzzzzzz, 'tt':3},...]
        this.msg_history = {};
        // Instantiate a jb2328 utility class e.g. for getBoundingBox()
        this.viz_tools = new VizTools();
        this.jb_tools = new VizTools2();
    }

    init() {
        let self = this;
        //this.do_connect(self, CONNECT_URL).then(console.log('post'))
        //.then(self.coonect_msg(self))


        self.connect(self, CONNECT_URL).then(function (socket) {

            console.log('prepare to send', socket)

            // server is ready here
            self.snd_msg(CONNECT_MSG).then(function (msg) {
                console.log('connect ok')
                socket.onmessage = self.on_message;
                self.send_message(CONNECT_FILTER);
            });

        }).catch(function (err) {
            console.log('errrrrr', err)
            // error here
        })
    }
    init2() {
        let self = this;

        //self.viz_tools.init();

        //declare the min max range of values for temp/co2/humidity - will change during runtime
        self.min_max_range = {
            'max': 3,
            'min': 0
        }

        //declare the main colorscheme for the heatmap
        self.color_scheme = d3.scaleSequential(d3.interpolateTurbo)

        //total time to draw transitions between activating the heatmap
        self.animation_dur = 350;

        socket = new SockJS(CONNECT_URL);

        socket.onopen = function () {
            console.log('open');
            socket.send(JSON.stringify(CONNECT_MSG));
        };

        socket.onmessage = function (e) {
            console.log('new message');
            var msg = JSON.parse(e.data);
            if (msg.msg_type != null && msg.msg_type == "rt_nok") {
                console.log('Error', e.data);
            }
            if (msg.msg_type != null && msg.msg_type == "rt_connect_ok") {
                console.log("Connected")
                document.getElementById('rt_monitor').innerHTML='Connected'
                socket.send(JSON.stringify(CONNECT_FILTER))
            }
            if (msg.msg_type != null && msg.msg_type == "rt_data") {
                let msg_data = JSON.parse(e.data).request_data[0]
                console.log(msg_data);
                let acp_id = msg_data.acp_id;

                //self.update_viz(self, acp_id, msg_data)
                self.update_floorplan(self, acp_id, msg_data);
            }
        };
    }

    update_floorplan(self, acp_id, msg_data) {
        //self.add_hist(self, acp_id, msg_data)
        //self.set_colorbar(self)
        // self.reset_animations(self)
        self.do_pre_transition(self, acp_id);
    }


    update_viz(self, acp_id, msg_data) {
        self.add_hist(self, acp_id, msg_data)
        self.set_colorbar(self)
        // self.reset_animations(self)
        self.do_pre_transition(self, acp_id);
    }

    mock_data(self) {
        let acp_id = self.sub_list[Math.floor(Math.random() * self.sub_list.length)];
        let msg_data = {
            'acp_id': acp_id,
            'acp_ts': 999,
            'payload_cooked': {
                "temperature": 21.7,
                "humidity": 19,
                "light": 21,
                "motion": 0,
                "vdd": 3652,
                "occupancy": 0
            }
        }
        //self.update_viz(self, acp_id, msg_data)
        self.update_floorplan(self, acp_id, msg_data);

    }
    set_colorbar(self) {
        let parent = self;
        parent.get_min_max(parent)

        //avoid havinf a colorbar with identical top and lower values
        if (self.min_max_range.max == self.min_max_range.min) {
            return
        }

        //recolor if changed min_max
        d3.selectAll('.sensor_circles').transition().duration(1000).style('fill', function (d, i) {
            let acp_id = d.acp_id;
            let pinged;
            let color;

            try {
                pinged = self.msg_history[acp_id].pinged;
                color = self.color_scheme(pinged);

                /* Create the text for each block */
                d3.select('#' + acp_id + '_pinged')
                    // .attr("dx", function (d) {
                    //     return -20
                    // })
                    .text(function (d) {
                        return pinged
                    })

            } catch (error) {
                color = 'white';
            }

            return color
        });

        d3.select("#legend_svg").remove();
        //d3.selectAll('.non_heatmap_circle').style('opacity', 0);
        let legend_svg_parent = d3.select('#legend_container');

        //configure canvas size and margins, returns and object
        //(width, height,top, right, bottom, left)
        let c_conf = parent.jb_tools.canvas_conf(110, 320, 20, 5, 20, 5);

        legend_svg_parent
            .append("svg")
            .attr("width", c_conf.width + c_conf.left + c_conf.right)
            .attr("height", c_conf.height + c_conf.top + c_conf.bottom)
            .attr('id', "legend_svg");
        let legend_svg = d3.select('#legend_svg');

        var scale = d3.scaleLinear().domain([c_conf.height, 0]).range([parent.min_max_range.min, parent.min_max_range.max]);
        var scale_inv = d3.scaleLinear().domain([parent.min_max_range.min, parent.min_max_range.max]).range([c_conf.height, 0]);

        //create a series of bars comprised of small rects to create a gradient illusion
        let bar = legend_svg.selectAll(".bars")
            .data(d3.range(0, c_conf.height), function (d) {
                return d;
            })
            .enter().append("rect")
            .attr("class", "bars")
            .attr("y", function (i) {
                return 20 + i;
            })
            .attr("x", c_conf.width / 3)
            .attr("height", 1)
            .attr("width", c_conf.width / 4)
            .style("fill", function (d, i) {
                return parent.color_scheme(scale(d));
            });


        //text showing range on left/right
        //viz_tools.add_text(TARGET SVG, TXT VALUE, X LOC, Y LOC, FONT SIZE, TRANSLATE);
        parent.jb_tools.add_text(legend_svg, parent.min_max_range.max, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.max), "0.75em", "translate(0,0)") // 0 is the offset from the left
        parent.jb_tools.add_text(legend_svg, parent.min_max_range.min, (c_conf.width / 2) - 3, scale_inv(parent.min_max_range.min) + 25, "0.75em", "translate(0,0)") // 0 is the offset from the left

        parent.jb_tools.add_text(legend_svg, 'pinged', (c_conf.width / 2) - 220, scale_inv(parent.min_max_range.min) - 265, "0.85em", "rotate(-90)") // 0 is the offset from the left

    }
    add_hist(self, acp_id, msg) {
        //test2['ccc']={'a':'b', 'c':[]}
        //test2.hasOwnProperty("ccc") // true
        let has_happened = self.msg_history.hasOwnProperty(acp_id);
        if (has_happened) {
            self.msg_history[acp_id].pinged = self.msg_history[acp_id].pinged + 1;
            self.msg_history[acp_id].msg_hist[0] = msg; //to CHANGE-> save two most recent messages
        } else {
            //create a new entry
            self.msg_history[acp_id] = {
                'acp_id': acp_id,
                'pinged': 1,
                'msg_hist': [msg]
            }
        }

        //get the txt box div
        let txt_hist = document.getElementById('text_collector');

        //reformat the message (for time or date)
        let recieved_time = self.viz_tools.make_time(msg.acp_ts) //alternatively use self.viz_tools.make_date(msg.acp_ts)

        //senf json object to the debug panel
        //*Important* only works with JSON.stringify(clean_msg_json)
        let clean_msg_json = {
            'acp_ts': msg.ts,
            'acp_id': msg.acp_id,
            'cooked': msg.payload_cooked
        }; //<br>'+INDENT+.substring(1, yourString.length-1)
        let cooked_txt = JSON.stringify(msg.payload_cooked); //optionally add (msg.payload_cooked,undefined, 10)10 is the indent
        let clean_msg_txt = recieved_time + '&nbsp&gt;&nbsp' + '<span id="green_span">' + msg.acp_id + "</span>" + '<pre id="json_msg">' + cooked_txt.substring(1, cooked_txt.length - 1) + '</pre>';

        // txt_hist.innerHTML = JSON.stringify(clean_msg) + '<br><br>' + txt_hist.innerHTML;
        txt_hist.innerHTML = clean_msg_txt + '<br><br>' + txt_hist.innerHTML;

        var recent = new Date();
        document.getElementById('most_recent').innerHTML = recent.toString().slice(0, 24);

        // txt_hist.innerHTML += JSON.stringify(clean_msg)+'\n';
    }

    do_pre_transition(self, acp_id) { //<-D
        self.do_transition(self, acp_id);


        for (var i = 1; i < 3; ++i) {

            let position = {
                'x': d3.select('#' + acp_id).attr('cx'),
                'y': d3.select('#' + acp_id).attr('cy'),
                'transf': d3.select('#' + acp_id).attr("transform")
            }

            var circle = d3.select('#bim_request').append("circle")
                .attr("cx", position.x)
                .attr("cy", position.y)
                .attr('transform', position.transf)
                .attr("r", 0)
                .style("stroke-width", 1 / (2*i))
                .style("fill", 'none')
                .style('stroke', '#cc0000')
                .transition()
                .delay(Math.pow(i, 2.5) * 100)
                .duration(2000)
                .ease(d3.easeSin)
                .attr("r", 5) //radius for waves
                .style("stroke-opacity", 0)
                .on("interrupt", function () {
                    d3.select(this).remove();
                })
                .on("end", function () {
                    d3.select(this).remove(); //remove ripples
                });
        }
    }

    do_transition(self, acp_id) {
        //let multiplier = 1.1; //10% increaseCIRCLE_RADIUS
        let sensor_circle = d3.select('#' + acp_id);
        let new_color = 'purple' //self.color_scheme(self.msg_history[acp_id].pinged);
        sensor_circle
            .transition().duration(700)
            .attr('r', CIRCLE_RADIUS / 3)
            //.ease(d3.easeBackInOut.overshoot(3.5))
            //flash red to indicate a splash
            .style('fill', 'red')
            //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
            .on("interrupt", function () {
                sensor_circle.attr('r', CIRCLE_RADIUS);
                sensor_circle.attr('fill', new_color);
            })
            .on('end', function (d) {
                sensor_circle
                    //fill the circle with the new color
                    .style('fill', new_color)
                    .transition().duration(450)
                    //overshoot the easing to add a little wiggle effect, brings some life to circles
                    // .ease(d3.easeBackInOut.overshoot(3.5))
                    .attr('r', CIRCLE_RADIUS)
                    //in case a new animation starts before the this one has finished, we want to finish the original ASAP 
                    .on("interrupt", function () {
                        sensor_circle.attr('r', CIRCLE_RADIUS);
                        sensor_circle.attr('fill', new_color);
                    });
            });
    }

    //callback to update sensors (for faked sensor data)
    update_callback(parent) {
        parent.mock_data(parent);
    }

    //async update for faked sensor data - updates all;
    //iterates through sensors and sets them to update on screen every *x* milliseconds
    update_sensors(parent, number) {

        for (let i = 0; i < number; i++) {
            window.setInterval(parent.update_callback, parent.jb_tools.random_int(6500, 6500 * 10), parent);
        }
    }



    //calculates value ranges for temp/co2/humidity and other during runtime;
    //recalculations are made whenever a new heatmap is selected
    get_min_max(parent) {

        let min = 999;
        let max = -999;

        //iterate through the data based on requested feature and extract min/max values
        for (let entry in parent.msg_history) {

            //    console.log('minmax', entry, parent.msg_history[entry].pinged)
            let val = parent.msg_history[entry].pinged

            if (val > max) {
                max = val;
            }
            if (val < min) {
                min = val;
            }
        }

        //reset the main variable
        parent.min_max_range = {
            max: max,
            min: 1
        };

        //reset min_max values for scaling
        parent.color_scheme.domain([parent.min_max_range.min, parent.min_max_range.max]);
        //parent.animation_delay.domain([parent.min_max_range.min, parent.min_max_range.max]);

        console.log('minmax', min, max)

    }
    connect(self, url) {
        return new Promise(function (resolve, reject) {
            console.log("Trying SockJS connection", url);
            socket = new SockJS(url);
            socket.onopen = function () {
                resolve(socket);
                self.on_open(self);
            };
            socket.onerror = function (err) {
                console.log("Error connecting: " + err.name + " " + err.message);
                reject(err);
            };

            socket.onmessage = self.on_msg;
            socket.onerror = self.on_error;
            socket.onclose = self.on_close;

        });
    }

    //send

    send_message(msg) {
        var message = msg;
        console.log(message, toString(message))
        socket.send(JSON.stringify(message));
        this.send_history_push(message);
        console.log("Sent message:\n" + maybe_prettyprint(message));
    }


    snd_msg(msg) {
        let self = this;
        //console.log(self)
        return new Promise(function (resolve, reject) {
            console.log("Trying to send msg");
            var message = msg;
            console.log(message, toString(message))
            socket.send(JSON.stringify(message));
            self.send_history_push(message);
            console.log("Sent message:\n" + maybe_prettyprint(message));


            socket.onmessage = function (event) {

                if (isString(event.data)) {
                    console.log("Received string message:\n" + maybe_prettyprint(event.data));
                    let obj = maybe_prettyprint(event.data);
                    // console.log(event.data, obj,obj.msg_type=="rt_connect_ok",event.data.msg_type=="rt_connect_ok",JSON.parse(obj).msg_type)
                    if (JSON.parse(obj).msg_type == "rt_connect_ok") {
                        resolve(socket);

                    };
                } else if (isArrayBuffer(event.data)) {

                    var uint8 = new Uint8Array(event.data);
                    var decoder = new TextDecoder('utf8');
                    var message_text = decoder.decode(uint8);
                    var message_hex = '';
                    for (var i = 0, l = uint8.byteLength; i < l; ++i) {
                        message_hex += toHex(uint8[i]) + " ";
                    }
                    console.log("Received binary message:\n" +
                        message_hex + "\n" +
                        maybe_prettyprint(message_text));
                } else {
                    console.log("Received unrecognised message type:\n" + event.data);
                    reject(err);
                }
            };
        });
    }

    async do_connect(self, url) {

        console.log("Connecting to " + url);

        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                console.log("Trying SockJS connection", url);
                socket = new SockJS(url);
            } else if (url.startsWith('ws://') || url.startsWith('wss://')) {
                console.log("Trying raw websocket connection");
                socket = new WebSocket(url);
            } else {
                console.log("Unrecognised scheme - expecting one of 'http', 'https', 'ws' or 'wss'");
                return;
            }

        } catch (e) {
            console.log("Error connecting: " + e.name + " " + e.message);
        }
        // binary messages in an arrayBuffer not a blob
        socket.binaryType = "arraybuffer";

        socket.onopen = self.on_open(self);
        socket.onmessage = self.on_message;
        socket.onerror = self.on_error;
        socket.onclose = self.on_close;

    }

    on_open(self) {

        console.log("Socket opened OK");
        // self.send_message(CONNECT_MSG)
    }


    async est_con(url) {
        return new Promise(resolve => {
            // setTimeout(() => {

            try {
                if (url.startsWith('http://') || url.startsWith('https://')) {
                    console.log("Trying SockJS connection", url);
                    socket = new SockJS(url);
                } else if (url.startsWith('ws://') || url.startsWith('wss://')) {
                    console.log("Trying raw websocket connection");
                    socket = new WebSocket(url);
                } else {
                    console.log("Unrecognised scheme - expecting one of 'http', 'https', 'ws' or 'wss'");
                    return;
                }
                resolve('resolved');

            } catch (e) {
                console.log("Error connecting: " + e.name + " " + e.message);
            }

            // }, 10);
        });
    }
    do_disconnect() {

        console.log("Disconnecting");
        socket.close();

    }



    get_sub() {

    }
    on_message(event) {

        if (isString(event.data)) {
            console.log("Received string message:\n")
            console.log(JSON.parse(event.data).request_data[0]);
        } else if (isArrayBuffer(event.data)) {

            var uint8 = new Uint8Array(event.data);
            var decoder = new TextDecoder('utf8');
            var message_text = decoder.decode(uint8);
            var message_hex = '';
            for (var i = 0, l = uint8.byteLength; i < l; ++i) {
                message_hex += toHex(uint8[i]) + " ";
            }
            console.log("Received binary message:\n" +
                message_hex + "\n" +
                maybe_prettyprint(message_text));
        } else {
            console.log("Received unrecognised message type:\n" + event.data);
        }

    }

    on_msg(event) {

        if (isString(event.data)) {
            console.log("Received string message:\n" + maybe_prettyprint(event.data));
        } else if (isArrayBuffer(event.data)) {

            var uint8 = new Uint8Array(event.data);
            var decoder = new TextDecoder('utf8');
            var message_text = decoder.decode(uint8);
            var message_hex = '';
            for (var i = 0, l = uint8.byteLength; i < l; ++i) {
                message_hex += toHex(uint8[i]) + " ";
            }
            console.log("Received binary message:\n" +
                message_hex + "\n" +
                maybe_prettyprint(message_text));
        } else {
            console.log("Received unrecognised message type:\n" + event.data);
        }

    }

    on_error(event) {

        // The API doesn't expose error details here
        console.log("Error occurred - see browser console for details");

    }

    on_close(event) {

        console.log("Socket closed, clean = " + event.wasClean +
            ", code = " + event.code + " (" + closeCodeToString(event.code) + ")" +
            ", reason = " + event.reason);

    }





    // Save current history
    save_send_history() {
        localStorage.setItem(history_key, JSON.stringify(send_history));
    }

    // Push a command onto history
    send_history_push(command) {
        send_history.push(command);
        send_history_cursor = send_history.length;
        this.save_send_history();
    }


}

// Test object types
function isString(x) {
    return Object.prototype.toString.call(x) === "[object String]";
}

function isArrayBuffer(x) {
    return Object.prototype.toString.call(x) === "[object ArrayBuffer]";
}
// Return message as pretty-printed JSON if possible, else message

function maybe_prettyprint(message) {

    try {
        var data = JSON.parse(message);
        return JSON.stringify(data, null, 4);
    } catch (e) {
        return message;
    }

}