"use strict"

class SVGImageChart {
    constructor(svgId, mainDivId, imageUrl, jsonDataUrl,jsonWeekUrl, scatterSvgId, scatterDivId) {
        this.svg = d3.select(`#${svgId}`);
        this.mainDiv = d3.select(`#${mainDivId}`);
        this.scatterSvg = d3.select(`#${scatterSvgId}`);
        this.scatterDiv = d3.select(`#${scatterDivId}`);
        this.imageUrl = imageUrl;
        this.jsonDataUrl = jsonDataUrl;
        this.jsonWeekUrl = jsonWeekUrl;
        this.xScale=d3.scaleLinear();
        
        this.init();
    }


    init() {
        const img = new Image();
        img.src = this.imageUrl;
        let width;
        let height;

        let w_scatter=width;
        let h_scatter=height/2;

        img.onload = () => {
             width = img.width / 10;
             height = img.height / 10;

            this.svg.attr("width", width).attr("height", height);
            this.mainDiv.style("width", `${width}px`)
                        .style("height", `${height}px`)
                        .style("background-image", `url('${img.src}')`)
                        .style("background-size", "contain")
                        .style("background-repeat", "no-repeat");

            // Initialize second SVG if needed
            this.initializeScatterplot(width,height/2.5);
                        
        };

        // Load data and create the charts
        d3.json(this.jsonDataUrl).then(data => {
            this.cookedData = this.parseData(data);
            let halfOfCookedData = Math.floor(this.cookedData.length/2);
            let sampleEntry = this.cookedData[halfOfCookedData]; // Adjust index as needed
            this.createChart(sampleEntry);
            this.createScatterplot(width,height/3); // Create scatterplot chart
        });
    

        window.addEventListener("resize", () => {
            const boundingRect = this.mainDiv.node().getBoundingClientRect();
            this.svg.attr("width", boundingRect.width)
                    .attr("height", boundingRect.height);
        });
    
    
        console.log(this.jsonWeekUrl);

                // Load data and create the bar chart
        d3.json(this.jsonWeekUrl).then(data => {
            console.log("Weeks' data");
            console.log(data);
            let cookedData = this.parseDataWeek(data);
            this.createVerticalBarChart(cookedData, 125, 250); // Adjust width and height as needed
        });

    }


// Function to parse data
 parseDataWeek(data) {
     console.log(data, data.readings)
    return data.readings
        .map(d => ({ crowdcount: d.payload_cooked["crowdcount"], date: new Date(d.filepath) }));
      //  .filter(d => d.crowdcount > -1);
}

createVerticalBarChart(data, width, height) {
    const margin = { top: 50, right: 5, bottom: 50, left: 70 }, // Adjusted bottom margin for x-axis label
        fullWidth = width + margin.left + margin.right,
        fullHeight = height + margin.top + margin.bottom;

    const yScale = d3.scaleBand()
        .range([0, height])
        .padding(0.1)
        .domain([0, 1, 2, 3, 4, 5, 6]); // Days of the week indices

    const xScale = d3.scaleLinear()
        .range([0, width])
        .domain([0, d3.max(data, d => d.crowdcount)]);

    const svg = d3.select("#third_drawing_div")
        .append("svg")
        .attr("width", fullWidth)
        .attr("height", fullHeight)
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg.selectAll(".bar")
        .data(data)
      .enter().append("rect")
        .attr("class", "bar")
        .attr("y", d => yScale(d.date.getDay()))
        .attr("height", yScale.bandwidth())
        .attr("x", 0)
        .style("fill", "blue")
        .attr("width", d => xScale(d.crowdcount));

    svg.append("g")
        .call(d3.axisLeft(yScale).tickFormat(index => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][index]));

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale).ticks(5));

    // Add x-axis label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40) // Position below the x-axis
        .style("font-size", "14px")
        .text("Crowdcount");

    // Add y-axis label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", (-height / 2))
        .attr("y", -64) // Position to the left of the y-axis
        .style("font-size", "9px")
        .text("Day of the Week");

    // Function to format date as DD/MM/YYYY
    function formatDate(date) {
        let d = date; // new Date(date * 1000);
        let day = ('0' + d.getDate()).slice(-2);
        let month = ('0' + (d.getMonth() + 1)).slice(-2);
        let year = d.getFullYear();
        return `${day}/${month}/${year}`;
    }
}



initializeScatterplot(w, h) {
    const scatterWidth = w;
    const scatterHeight = h;

    this.scatterSvg.attr("width", scatterWidth).attr("height", scatterHeight);
    this.scatterDiv.style("width", `${scatterWidth}px`).style("height", `${scatterHeight}px`);

    // Update slider scales to align with xScale
    this.reverseSliderScaling = d3.scaleLinear()
        .domain([0, scatterWidth])
        .range([new Date().setHours(8, 0, 0, 0), new Date().setHours(20, 0, 0, 0)]);

    this.directSliderScaling = this.xScale;  // Use the xScale directly for the slider
}


    createScatterplot(w,h) {

        const width = parseInt(this.scatterSvg.attr("width"));
        const height = parseInt(this.scatterSvg.attr("height"))-50;
        console.log(this.cookedData);
        let halfOfCookedData = Math.floor(this.cookedData.length/2);
      
        // Create scales and axes
        const timeExtent = [
            new Date(d3.min(this.cookedData, d => d.acp_ts)).setHours(8, 0, 0, 0),
            new Date(d3.max(this.cookedData, d => d.acp_ts)).setHours(20, 0, 0, 0)
        ];
        
        this.xScale = d3.scaleTime()
            .range([0, width])
            .domain(timeExtent.map(ts => new Date(ts))); // Convert back to Date objects
        

            console.log("BOUNGIORNO");

        // const yScale = d3.scaleLinear()
        //     .range([height, 0])
        //     .domain([0, d3.max(this.cookedData, d => d.crowdcount)]);
        const yScale = d3.scaleLinear()
            .range([height, 0])
            .domain(d3.extent(this.cookedData, d => d.crowdcount));

            

        // Data binding and rendering for scatterplot

     var lineGenerator = d3.line()
     .x(d => this.xScale(d.acp_ts))
     .y(d => yScale(d.crowdcount));
 
     this.scatterSvg.append("path")
     .datum(this.cookedData) // Binds data to the line
     .attr("class", "line") // Assigns a class for styling
     .attr("d", lineGenerator)
     .style("fill", "none")
     .style("stroke", "red")
     .style("stroke-width", "1px");

    this.scatterSvg.selectAll(".dot")
    .data(this.cookedData)
    .enter().append("circle")
    .attr("class", "dot")
    .attr("cx", d => this.xScale(d.acp_ts)) // x position based on 'acp_ts'
    .attr("cy", d => yScale(d.crowdcount)) // y position based on 'crowdcount'
    .attr("r", 2) // Radius of the circles
    .style("fill", "red")
    .style("opacity", 0.1);
// Adding axes with uniform HH:MM formatting
this.scatterSvg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(this.xScale)
        .ticks(24)
        .tickFormat(d3.timeFormat("%H:%M"))) // Format ticks as HH:MM
    .selectAll("text")  
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-90)"); // Optional rotation for better readability

// X-axis label
this.scatterSvg.append("text")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height + 50) // Adjust based on margin
    .style("font-size", "14px")
    .text("Time");

// Y-axis with axis name
this.scatterSvg.append("g")
    .call(d3.axisLeft(yScale).ticks(10))
    .append("text")
    .attr("text-anchor", "middle")
    .attr("transform", `rotate(-90)`)
    .attr("x", -height / 2)
    .attr("y", -40) // Adjust for positioning
    .style("font-size", "14px")
    .text("People");


     // Adjust y-axis to be on the right side
     this.scatterSvg.append("g")
     .attr("transform", `translate(${0}, 0)`) // Move y-axis to the right
     .call(d3.axisRight(yScale).ticks(10).tickFormat(d3.format(".0f")));

        console.log("hi");

               // Define scales
               const reverseSliderScaling = d3.scaleLinear()
               .domain([0, width])
               .range(d3.extent(this.cookedData, d => d.acp_ts * 1000));
   
           const directSliderScaling = d3.scaleLinear()
               .domain(d3.extent(this.cookedData, d => d.acp_ts))
               .range([0, width]);
   
           // Add the line for the slider
           let sliderLine = this.scatterSvg.append("line")
           .attr('id', 'plot_line')
               .attr('x1', directSliderScaling(this.cookedData[Math.floor(halfOfCookedData)].acp_ts))
               .attr('y1', 0)
               .attr('x2', directSliderScaling(this.cookedData[Math.floor(halfOfCookedData)].acp_ts))
               .attr('y2', height)
               .attr("stroke", "white")
               .attr("stroke-width", 6)
               .style("opacity", 1)
               .attr("cursor", "move")
               .call(d3.drag()
                .on('start', this.dragStart)
                .on('drag', (event) => this.dragging(event))
                .on('end', this.dragEnd))
               .on('mouseover', event => d3.select(event.target).attr("stroke-width", 9).style("opacity", 0.5))
               .on('mousemove', event => d3.select(event.target).attr("stroke-width", 9))
               .on('mouseout', event => d3.select(event.target).attr("stroke-width", 6).style("opacity", 1));
      

     
    }


    createChart(specificEntry) {
       
        d3.selectAll(".seats").remove();

        const width = parseInt(this.svg.attr("width"));
        const height = parseInt(this.svg.attr("height"));

        // Drawing circles for occupied seats
        let occupiedSeats = this.getOccupiedSeats(specificEntry, seats, width, height);

        occupiedSeats.forEach(seat => {
            this.svg.append("circle")
                .attr("class", "seats")
                .attr("cx", seat.x)
                .attr("cy", seat.y)
                .attr("r", 5)
                .attr("fill", "blue")
                .append("title")
                .text(`Seat: ${seat.seat_id}`);
        });
    }

  
    dragStart(event) {
        d3.select(this).style("stroke", "black");
    }

    dragging(event) {
        // console.log("event", event);
        const xCoor = event.x;
        const sliderLine = d3.select("#plot_line");

        sliderLine
            .attr("x1", xCoor)
            .attr("x2", xCoor);

        let unix_ts = parseInt(this.reverseSliderScaling(xCoor) / 1000);
        // let unix_ts = this.reverseSliderScaling(xCoor);

        // console.log(xCoor, unix_ts);

        // Find the closest point in cookedData to the line
        let match=this.findClosestDataPoint(xCoor);
        
        // let sampleEntry = this.cookedData[111]; // Adjust index as needed
        this.createChart(match);
        this.updateText(match.acp_ts); // Update the text on the SVG
    }


    updateText(data) {
        const formatDate = (dateString) => {
            const date = new Date(dateString);
            return date.toLocaleString(); // Formats date and time based on the user's locale
        };

        
        // Select existing text element, if it doesn't exist, create one
        const text = this.svg.selectAll(".closest-data-text")
            .data([data]) // Bind data
            .join(
                enter => enter.append("text").attr("class", "closest-data-text"),
                update => update,
                exit => exit.remove()
            );


    text.attr("x", 200)
    .attr("y", 450)
    .text(data ? formatDate(data) : 'No Data');
    }
    
    findClosestDataPoint(xCoor) {
        // Use xScale directly to align with scatterplot and slider positions
        let minDistance = Infinity;
        let closestData = null;
    
        this.cookedData.forEach(d => {
            // Map acp_ts to x-axis position using xScale
            let scaledX = this.xScale(d.acp_ts);
            let distance = Math.abs(scaledX - xCoor);
    
            if (distance < minDistance) {
                minDistance = distance;
                closestData = d;
            }
        });
    
        if (closestData) {
            console.log("Closest data: ", closestData.acp_ts);
            return closestData;
        }
    
        return {};
    }
    
    dragEnd(event) {
        d3.select(this).style("stroke", "white");
    }

    reverseSliderScaling = d3.scaleLinear()

    // Function to get occupied seats
getOccupiedSeats(entry, seats, width, height) {
    let occupiedSeats = [];
    for (let seatId in entry.seats_occupied) {
        if (entry.seats_occupied.hasOwnProperty(seatId)) {
            let seatPos = seats["seats"][seatId];
            if (seatPos) {
                occupiedSeats.push({
                    x: (seatPos.x / seats["input_image"]["width"]) * width,
                    y: (seatPos.y / seats["input_image"]["height"]) * height,
                    seat_id: seatId
                });
            }
        }
    }
    return occupiedSeats;
}

    // parseData(data) {
    //     return data.readings
    //         .map(d => ({ ...d.payload_cooked, acp_ts: new Date(d.acp_ts * 1000) }))
    //         .filter(d => d.crowdcount > -1);
    // }
    parseData(data) {
        this.cookedData = data.readings
            .map(d => ({ ...d.payload_cooked, acp_ts: new Date(d.acp_ts * 1000) }))
            .filter(d => d.crowdcount > -1);
        return this.cookedData;
    }
    
}

document.addEventListener("DOMContentLoaded", () => {
    const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
     const date = urlParams.get('date');
     const type = urlParams.get('type');
		      
const CERBERUS_ACP_ID="cerberus-"+type+"-lt1";
  const URL="http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_day_cerberus/"+CERBERUS_ACP_ID+"/?date="+date.toString();
  const URL_WEEK="http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_week_cerberus/"+CERBERUS_ACP_ID+"/?date="+date.toString();

  ///?date=2024-01-19  


  new SVGImageChart(
        "drawing_svg", "main_drawing_div",
        "http://adacity-jb.al.cl.cam.ac.uk/static_web/space/images/LT1_seating_uncompressed.png",
        URL,
        URL_WEEK,
        "scatterplot_svg", "secondary_drawing_div"
    );
});