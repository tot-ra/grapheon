var graph;

stoppable_drawing = 0;

google.load('visualization', '1', {packages: ['corechart']});

$(document).ready(function(){
	graph = LargeGraph('canvas');
    graph.draw();
    graph.process();


		
	setInterval(function(){
		if(graph.getKineticEnergy()==0 && stoppable_drawing){
			graph.options.active=0;
		}
		$('#step').html(graph.step);
		$('#kinetic_energy').html(graph.getKineticEnergy());
		$('#cycle_time').html(graph.cycle_time);
		iNodes = count(graph.nodes);
		iConnections = graph.connection_count;
		
		$('#nodes').html(iNodes);
		$('#connections').html(iConnections);
		$('#density').html( (iConnections / (0.5*iNodes*(iNodes-1))).toFixed(2) );









        var adjacency_matrix_ctx = document.getElementById('adjacency_matrix').getContext("2d");
        var adjacency_cell_size= /*(count(graph.nodes)>150) ? 2 : */425/(count(graph.nodes));
        adjacency_matrix_size = count(graph.nodes)*adjacency_cell_size;

        $('#adjacency_matrix').width(adjacency_matrix_size);
        $('#adjacency_matrix').height(adjacency_matrix_size);

        adjacency_matrix_ctx.beginPath();
        adjacency_matrix_ctx.fillStyle = "#fff";
        adjacency_matrix_ctx.fillRect(0, 0, 425, 425);

        adjacency_matrix_ctx.fillStyle = "#000";
        adjacency_matrix_ctx.lineWidth=1;


        adjacency_matrix_ctx.strokeStyle = "black";


        if(adjacency_cell_size>4){
            adjacency_matrix_ctx.moveTo(0,0);
            adjacency_matrix_ctx.lineTo(adjacency_matrix_size,0);
            adjacency_matrix_ctx.lineTo(adjacency_matrix_size,adjacency_matrix_size);
            adjacency_matrix_ctx.lineTo(0,adjacency_matrix_size);
            adjacency_matrix_ctx.lineTo(0,0);
            
            for(var i=0;i<count(graph.nodes);i++){
                adjacency_matrix_ctx.moveTo(0,i*adjacency_cell_size);
                adjacency_matrix_ctx.lineTo(adjacency_matrix_size,i*adjacency_cell_size);

                adjacency_matrix_ctx.moveTo(i*adjacency_cell_size,0);

                adjacency_matrix_ctx.lineTo(i*adjacency_cell_size,adjacency_matrix_size);
            }
        }




        for(src in graph.connections){
            var x = keyPos(graph.nodes, src);
            for(dst in graph.connections[src]){
                var y = keyPos(graph.nodes, dst);
                /*console.log(src+'='+dst);
                console.log(x+'>'+y);*/
                adjacency_matrix_ctx.fillRect(x*adjacency_cell_size,y*adjacency_cell_size,adjacency_cell_size,adjacency_cell_size);
            }
        }

        adjacency_matrix_ctx.stroke();
        adjacency_matrix_ctx.closePath();

        
	}, 1000);

    setTimeout('drawDegreeDistribution()', 3000);

    $( "#energy_damping_control" ).slider({
        min:75,
        max:100,
        value:95,
        slide:function(event,ui){
            $('#energy_damping').html(ui.value);
            graph.options.energy_damping_percent=(ui.value/100).toFixed(2);
        }
    });
    $( "#repulsion_coeff_control" ).slider({
        min:0.1,
        step:0.1,
        max:10,
        value:0.5,
        slide:function(event,ui){
            $('#repulsion_coeff').html(ui.value);
            graph.options.repulsion_coeff=(ui.value).toFixed(2);
        }
    });
    $( "#node_radius_control" ).slider({
        min:1,
        max:20,
        value:15,
        slide:function(event,ui){
            graph.options.radius_ratio = ui.value;
        }
    });
    $( "#draw_with_min_mass" ).slider({
        min:0,
        max:50,
        value:0,
        slide:function(event,ui){
            graph.options.draw_with_min_mass = ui.value;
            $('#draw_with_min_mass_val').html( ui.value);
        }
    });

    $('#energy_damping').html(((graph.options.energy_damping_percent)*100).toFixed(0));
});


//Draw degree distribution periodically
function drawDegreeDistribution(){
    if(graph.options.active) {
        var data = new google.visualization.DataTable();
        data.addColumn('number', 'Node degree');
        data.addColumn('number', 'Number of nodes');
        //    data.addColumn('number', 'Shape 1');

        var aDegrees = graph.getDegreeArray();

        for(x in aDegrees){
            data.addRow([1*x, 1*aDegrees[x]]);
        }

        // Create and draw the visualization.
        var chart = new google.visualization.ScatterChart(document.getElementById('degree_canvas'));
        chart.draw(data, {title: 'Degree distribution',
            width: 415, height: 220,
            pointSize:2,
            legend:'none',
            vAxis: {title: "Number of nodes", titleTextStyle: {color: "green"}},
            hAxis: {title: "Node degree", titleTextStyle: {color: "green"}}}
                );

    }
    redraw_time = graph.cycle_time*50;
    if(redraw_time<3000) redraw_time = 3000;
    setTimeout('drawDegreeDistribution()',redraw_time);
}
