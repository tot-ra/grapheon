/**
 * @author Artjom Kurapov
 * @since 24.05.11 0:09
 */
$(document).ready(function(){

	$.each(arrNodes, function(i, o){
		graph.addNode(o.ID,0,o.title,i/count(arrNodes));
	});


    $.each(arrConnections, function(i, o){
        //graph.addConnection(o.dst, o.src, o.weight);
		graph.addConnection(o.src, o.dst, o.weight);
	});

	$('#clustering_level').html(graph.getClusteringLevel().toFixed(2));
});