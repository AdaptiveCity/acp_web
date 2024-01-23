"use strict"

class SVGImageChart {
    constructor(svgId, mainDivId, imageUrl, jsonDataUrl, scatterSvgId, scatterDivId) {
        this.svg = d3.select(`#${svgId}`);
        this.mainDiv = d3.select(`#${mainDivId}`);
        this.scatterSvg = d3.select(`#${scatterSvgId}`);
        this.scatterDiv = d3.select(`#${scatterDivId}`);
        this.imageUrl = imageUrl;
        this.jsonDataUrl = jsonDataUrl;
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
    }



    initializeScatterplot(w,h) {
        // Set up the dimensions and styles for the second SVG
        const scatterWidth = w; // Set appropriate width
        const scatterHeight = h; // Set appropriate height

        this.scatterSvg.attr("width", scatterWidth).attr("height", scatterHeight);
        this.scatterDiv.style("width", `${scatterWidth}px`).style("height", `${scatterHeight}px`);
    }

    createScatterplot(w,h) {

        const width = parseInt(this.scatterSvg.attr("width"));
        const height = parseInt(this.scatterSvg.attr("height"))-50;
        console.log(this.cookedData);
        let halfOfCookedData = Math.floor(this.cookedData.length/2);
        // Create scales and axes
        const xScale = d3.scaleTime()
            .range([0, width])
            .domain(d3.extent(this.cookedData, d => d.acp_ts));

        const yScale = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(this.cookedData, d => d.crowdcount)]);
            //.domain([0, 264]);

        // Data binding and rendering for bars
        this.scatterSvg.selectAll(".bar")
            .data(this.cookedData)
            .enter().append("rect")
            .attr("class", "bar")
            .attr("x", d => xScale(d.acp_ts))
            .attr("width", 1)
            .attr("y", d => yScale(d.crowdcount))
            .attr("height", d => height - yScale(d.crowdcount))
            .style("fill", "red")
            .style("opacity", 0.1);

        // Adding axes with rotated x-axis ticks
        this.scatterSvg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).ticks(20))
        .selectAll("text")  
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)"); // Rotate the text

     // Adjust y-axis to be on the right side
     this.scatterSvg.append("g")
     .attr("transform", `translate(${0}, 0)`) // Move y-axis to the right
     .call(d3.axisRight(yScale).ticks(10).tickFormat(d3.format(".0f")));

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
        const directSliderScaling = d3.scaleLinear()
            .domain(d3.extent(this.cookedData, d => d.acp_ts))
            .range([0, parseInt(this.scatterSvg.attr("width"))]);

        let minDistance = Infinity;
        let closestData = null;

        this.cookedData.forEach(d => {
            let scaledX = directSliderScaling(d.acp_ts);
            let distance = Math.abs(scaledX - xCoor);

            if (distance < minDistance) {
                minDistance = distance;
                closestData = d;
            }
        });

        if (closestData) {
            console.log("Closest data: ", closestData.acp_ts);

            return closestData
        }

        return {}
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

    parseData(data) {
        return data.readings
            .map(d => ({ ...d.payload_cooked, acp_ts: new Date(d.acp_ts * 1000) }))
            .filter(d => d.crowdcount > -1);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
     const date = urlParams.get('date');

		      

  const URL="http://adacity-jb.al.cl.cam.ac.uk/api/readings/get_day_cerberus/cerberus-middle-lt1/?date="+date.toString();
  ///?date=2024-01-19  


  new SVGImageChart(
        "drawing_svg", "main_drawing_div",
        "http://adacity-jb.al.cl.cam.ac.uk/static_web/space/images/LT1_seating_uncompressed.png",
        URL,
        "scatterplot_svg", "secondary_drawing_div"
    );
});