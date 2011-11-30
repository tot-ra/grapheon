var graph;

stoppable_drawing = 0;

$(document).ready(function(){
	graph = LargeGraph('canvas');
    graph.options.labels.visible=1;
    graph.options.nodes.visible=0;
    graph.draw();
    graph.process();

		
	setInterval(function(){
		if(graph.getKineticEnergy()==0 && stoppable_drawing){
			graph.options.active=0;
		}
        
	}, 1000);

    //setTimeout('drawDegreeDistribution()', 3000);
});