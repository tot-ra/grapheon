$(document).ready(function(){

	$.each(arrNodes, function(i, o){
		graph.addNode(o.ID,0,o.title);
	});

    
    $.each(arrConnections, function(i, o){
        //graph.addConnection(o.dst, o.src, o.weight);
		graph.addConnection(o.src, o.dst, o.weight);
	});
	
	$('#clustering_level').html(graph.getClusteringLevel().toFixed(2));
});