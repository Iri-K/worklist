var page;
var lockGetWorklist = 0;
var status_refresh = 5 * 1000;
var statusTimeoutId = null;
var lastStatus = 0;

// This variable needs to be in sync with the PHP filter name
var filterName = '.worklist';
var affectedHeader = false;
var directions = {"ASC":"images/arrow-up.png","DESC":"images/arrow-down.png"};
var lastId;

var topIsOdd = true;
var timeoutId;
var workitem = 0;
var workitems;
var dirDiv;
var dirImg;

var addFromJournal = false;
var resetOrder = false;
var skills = null;

stats.setUserId(user_id);

$(document).ready(function() {

    // Fix the layout for the User selection box
    var box_h = $('select[name=user]').height() +1;
    $('#userbox').css('margin-top', '-'+box_h+'px');

    // Validate code review input
    $(':checkbox').change(function() {
        validateCodeReviews();
    });

    dirDiv = $("#direction");
    dirImg = $("#direction img");
    hdr = $(".table-hdng");
    if (sort != 'delta') {
        hdr.find(".clickable").each(function() {
            if ($(this).text().toLowerCase() == unescape(sort.toLowerCase())) {
                affectedHeader = $(this);
            }
        });
    }
    else {
        affectedHeader = $('#defaultsort');
    }
    hdr.find(".clickable").click(function() {
        affectedHeader = $(this);
        orderBy($(this).text().toLowerCase());
    });

    GetWorklist(page, false, true);

    reattachAutoUpdate();

    $('#query').keypress(function(event) {
        if (event.keyCode == '13') {
            event.preventDefault();
            $("#searchForm").submit();
        }
    });

    $("#search_reset").click(function(e){
        e.preventDefault();
        $("#query").val('');
        affectedHeader = false;
        resetOrder = true;
        sort = 'null';
        dir = 'asc';
        GetWorklist(1, false);
        return false;
    });

    $("#search_comments").change(function(e) {
        affectedHeader = false;
        resetOrder = true;
        sort = 'null';
        dir = 'asc';
        GetWorklist(1, false);
    });

    $("#searchForm").submit(function(){
        var query = $('#query').val();
        GetWorklist(1, false);
        return false;
    });

    //-- gets every element who has .iToolTip and sets it's title to values from tooltip.php
    // function commented for remove tooltip
    //setTimeout(MapToolTips, 800);

    // bind on creation of newList
    if ($('#projectCombo').length !== 0) {
        createActiveFilter('#projectCombo', 'projects', 1);
    }

    if(getQueryVariable('status') != null) {
        if (timeoutId) clearTimeout(timeoutId);
        GetWorklist(page, false);
    }
});

function AppendPagination(page, cPages, table)    {
    // support for moving rows between pages
    if (table == 'worklist') {
        // preparing dialog
        $('#pages-dialog select').remove();
        var selector = $('<select>');
        for (var i = 1; i <= cPages; i++) {
            selector.append('<option value = "' + i + '">' + i + '</option>');
        }
        $('#pages-dialog').prepend(selector);
    }
    
    var previousLink = page > 1 
            ? '<a class="previous" href="' + selfLink + (page-1) + '">Previous</a> ' 
            : '<span class="previous inactive">Previous</span>',
        nextLink = page < cPages 
            ? '<a class="next" href="' + selfLink + (page+1) + '">Next</a> ' 
            : '<span class="next inactive">Next</span>';
    
    var pagination = 
        '<tr bgcolor="#FFFFFF" class="row-' + table + '-live ' + table + '-pagination-row nodrag nodrop">' +
        '<td class="not-workitem" colspan="6" style="text-align:center;"><span>' + previousLink;
        
    var fromPage = 1;
    if (cPages > 10 && page > 6) {
        if (page + 4 <= cPages) {
            fromPage = page - 6;
        } else {
            fromPage = cPages - 10;
        }
    }
    
    for (var i = fromPage; (i <= (fromPage +10) && i <= cPages); i++) {
        if (i == page) {
            pagination += '<span class="page current">' + i + "</span> ";
        } else {
            pagination += '<a class="page" href="' + selfLink + '?page=' + i + '" >' + i + '</a> ';
        }
    }
    pagination += nextLink + '</span></td></tr>';
    $('.table-' + table).append(pagination);
}
// see getWorklist in api.php for json column mapping
function AppendRow (json, odd, prepend, moreJson, idx) {
    var row;
    row = '<tr id="workitem-' + json[0] + '" class="row-worklist-live iToolTip hoverJobRow ';

    // disable dragging for all rows except with "BIDDING" status
    if (json[2] != 'Bidding') {
        row += ' nodrag ';
    }

    if (odd) {
        row += ' rowodd';
    } else {
        row += 'roweven';
    }

    // Check if the user is either creator, runner, mechanic and assigns the rowown class
    // also highlight expired and tasks bidding on
    if (user_id == 0) { // Checks if a user is logged in, as of now it
                        // would show to non logged in users, since mechanic
                        // aren't checked for session
    } else if(user_id == json[13]) {// Runner
        row += ' rowrunner';
    } else if(user_id == json[14]) {// Mechanic
        row += ' rowmechanic';
    } else if(json[15] >0) { //user bid on this task
        row += ' rowbidon';
    } else if(json[19] == 'expired') { // bid expired
        row += ' rowbidexpired';
    } else if(user_id == json[9]) { // Creator
        row += ' rowown';
    }

    row += '">';

    var project_link = worklistUrl + '' + json[17];
    row +=
        '<td class="clickable not-workitem project-col" onclick="location.href=\'' + project_link + '\'">' +
            '<div class="taskProject" id="' + json[16] + '">' +
                '<span><a href="' + project_link + '">' + (json[17] == null ? '' : json[17]) + '</a></span>' +
            '</div>' +
        '</td>';
    //If job is a bug, add reference to original job
    if( json[18] > 0) {
        extraStringBug = '<small> (bug of '+json[18]+ ') </small>';
    } else {
        extraStringBug = '';
    }

    // Displays the ID of the task in the first row
    // 26-APR-2010 <Yani>
    var workitemId = 'workitem-' + json[0];
    row += '<td>' + 
             '<div id="' + workitemId + '" class="taskSummary">' +
               '<span>' +
                 '<span class="taskID">#' + json[0] + '</span> - ' +
                 json[1] + extraStringBug +
               '</span>' +
             '</div>' +
           '</td>';
    var bidCount = '';
    if ((json[2] == 'Bidding' || json[2] == 'SuggestedWithBid') && json[10] > 0) {
        bidCount = ' (' + json[10] + ')';
    }
    row += '<td class="status-col"><div class="taskStatus"><span>' + json[2] + bidCount + '</span></td>';

    var who = '',
        createTagWho = function (id, nickname, type) {
            return '<span class="' + type + '" title="' + id + '">' + nickname + '</span>';
        };
    if (json[3] == json[4]) {
        // creator nickname can't be null, so not checking here
        who += createTagWho(json[9],json[3],"creator");
    } else {
        var runnerNickname = json[4] != null ? ', ' + createTagWho(json[13], json[4], "runner") : '';
        who += createTagWho(json[9], json[3], "creator") + runnerNickname;
    }
    if (json[5] != null){
        who += ', ' + createTagWho(json[14], json[5], "mechanic");
    }

    row += '<td class="who not-workitem who-col">' + 
             '<div class="taskWho">' +
               who + 
             '</div>' +
           '</td>';
    
    if (json[2] == 'Working' && json[11] != null) {
        var pastDuePre = '', 
            pastDuePost = '',
            strAge = RelativeTime(json[11], true);
        if (strAge.substr(0, 1) == '-') {
            strAge = strAge.substr(1);
            strAge = "<span class='past-due'>Due: " + strAge + '</div>';
        } else {
            strAge = strAge + ' from now';
        }
        row += '<td class="age-col">' +
                 '<div class="taskAge">' + 
                   '<span>' +
                     strAge
                   '</span>' +
                 '</div>' +
               '</td>';
    } else if (json[2] == 'Done' ) {
if (json[6] != null){
        row += '<td class="age-col">' +
                 '<div class="taskAge">' + 
                   '<span>' +
                     RelativeTime(json[6], true) +
                   '</span>' +
                 '</div>' +
                '</td>';
        } else {
        row += '<td class="age-col">' +
                 '<div class="taskAge">' + 
                   '<span>' +
                     'unknown'
                   '</span>' +
                 '</div>' +
               '</td>';
        }
    } else {
        row += '<td class="age-col">' +
                 '<div class="taskAge">' + 
                   '<span>' +
                     RelativeTime(json[6], true) +
                   '</span>' +
                 '</div>' +
               '</td>';
    }

    // Comments
    comments = (json[12] == 0) ? "" : json[12];
    row += '<td class="age-col">' + 
             '<div class="taskComments">' + 
               '<span>' +
                 comments +
               '<span>' +
             '</div>' +
           '</td>';

    row += '</tr>';
    if (prepend) {
        // animate in each row
        $(row).hide().prependTo('.table-worklist tbody').fadeIn(300);
        $('#workitem-' + json[0]).removeAttr('style');
        setTimeout(function(){
            if (moreJson && idx-- > 1) {
                topIsOdd = !topIsOdd;
                AppendRow(moreJson[idx], topIsOdd, true, moreJson, idx);
            }
        }, 300);
    } else {
        $('.table-worklist tbody').append(row);
    }
    // Apply additional styling
    additionalRowUpdates(workitemId);
}

function Change(obj, evt)    {
    if(evt.type=="focus")
        obj.style.borderColor="#6A637C";
    else if(evt.type=="blur")
       obj.style.borderColor="#d0d0d0";
}

function ClearSelection () {
    if (document.selection)
        document.selection.empty();
    else if (window.getSelection)
        window.getSelection().removeAllRanges();
}

function SetWorkItem(item) {
    var match;
    if (item.attr('id')) {
        match = item.attr('id').match(/workitem-\d+/);
    }
    if (match) {
        workitem = match[0].substr(9);
    } else {
        workitem = 0;
    }
    return workitem;
}

function orderBy(option) {
    if (option == sort) dir = ((dir == 'asc')? 'desc':'asc');
    else {
        sort = option;
        dir = 'asc';
    }
    GetWorklist(1, false);
}

function GetWorklist(npage, update, reload) {
   if (addFromJournal) {
        return true;
    }
    while(lockGetWorklist) {
        // count atoms of the Universe untill old instance finished...
    }
    lockGetWorklist = 1;
    if (timeoutId) {
        clearTimeout(timeoutId);
    }
    loaderImg.show("loadRunning", "Loading, please wait ...");
    var search_status = '',
        search_user = '0',
        search_project = '0',
        save_filter = true,
        mobile_filter = false;
    
    if ($('#projectFilter').is(':visible')) {
        search_project = $('.projectComboList .ui-combobox-list-selected').attr('val');
    } else {
        search_project = 'All';
        reload = undefined;
        save_filter = false;
    }
    
    if ($('#userFilter').is(':visible')) {
        search_user = $('.userComboList .ui-combobox-list-selected').attr('val');
    } else {
        reload = undefined;
        save_filter = false;
        if (userId) {
            search_user = '' + userId;
        } else {
            search_user = 'ALL';
        }            
    }
    
    search_status = ($('#statusCombo').val() || []).join("/");
    if (!$('#jobStatusFilter').is(':visible') || (search_status == 'Review' && only_needs_review_jobs)) {
        reload = undefined;
        save_filter = false;
        if (search_status == 'Review' && only_needs_review_jobs) {
            search_status = 'Needs-Review';
        } else if (userId) {
            search_status = 'Bidding/Working/Functional/SvnHold/Review/Completed';
            mobile_filter = true;
        } else {
            search_status = 'Bidding';
        }
    }
    
    $.ajax({
        type: "POST",
        url: 'api.php',
        cache: false,
        data: {
            action: 'getWorklist',
            page: npage,
            project_id: search_project,
            status: search_status,
            sort: sort,
            dir: dir,
            user: search_user,
            inComment: $('#search_comments').is(':checked') ? 1 : 0,
            query: $("#query").val(),
            reload: ((reload == undefined) ? false : true),
            save: save_filter,
            mobile: mobile_filter
        },
        dataType: 'json',
        success: function(json) {
            if (json[0] == "redirect") {
                lockGetWorklist = 0;
                $("#query").val('');
                window.location.href = buildHref( json[1] );
                return false;
            }

            loaderImg.hide("loadRunning");
            if (affectedHeader) {
                affectedHeader.append(dirDiv);
                dirImg.attr('src',directions[dir.toUpperCase()]);
                dirDiv.css('display','block');
            } else {
                if (resetOrder) {
                    dirDiv.css('display','none');
                    resetOrder = false;
                }
            }
            affectedHeader = false;
            page = json[0][1]|0;
            var cPages = json[0][2]|0;

            $('.row-worklist-live').remove();
            workitems = json;
            if (!json[0][0]) return;

            // When updating, find the last first element
            for (var lastFirst = 1; update && lastFirst < json.length && lastId != json[lastFirst][0]; lastFirst++);

            if (update && lastId && lastFirst == json.length) {
                // lastId has disappeared from the list during an update.. avoid copious animations by reverting lastFirst
                lastFirst = 1;
            }
            
            // Output the worklist rows.
            var odd = topIsOdd;
            for (var i = lastFirst; i < json.length; i++) {
                AppendRow(json[i], odd);
                odd = !odd;
            }

            AppendPagination(page, cPages, 'worklist');

            if (update && lastFirst > 1) {
                // Update the view by scrolling in the new entries from the top.
                topIsOdd = !topIsOdd;
                AppendRow(json[lastFirst-1], topIsOdd, true, json, lastFirst-1);
            }
            lastId = json[1][0];

            $('.worklist-pagination-row a').click(function(e){
                page = $(this).attr('href').match(/page=\d+/)[0].substr(5);
                if (timeoutId) clearTimeout(timeoutId);
                GetWorklist(page, false);
                e.stopPropagation();
                lockGetWorklist = 0;
                return false;
            });

        },
        error: function(xhdr, status, err) {
            $('.row-worklist-live').remove();
            $('.table-worklist').append('<tr class="row-worklist-live rowodd"><td colspan="5" align="center">Oops! We couldn\'t find any work items.  <a id="again" href="#">Please try again.</a></td></tr>');
//              Ticket #11560, hide the waiting message as soon as there is an error
            loaderImg.hide("loadRunning");
//              Ticket #11596, fix done with 11517
//              $('#again').click(function(){
            $('#again').click(function(e){
//                  loaderImg.hide("loadRunning");
                if (timeoutId) clearTimeout(timeoutId);
                GetWorklist(page, false);
                e.stopPropagation();
                lockGetWorklist = 0;
                return false;
            });
        }
    });

    timeoutId = setTimeout("GetWorklist("+page+", true, true)", ajaxRefresh);
    lockGetWorklist = 0;
}


function additionalRowUpdates(workitemId) {
    // Apply only once to new rows, either on an update or original load.
    var rowQuery = 'tr.row-worklist-live';
    var taskQuery = '.taskSummary';
    if (workitemId != undefined) {
        rowQuery += '#' + workitemId;
        taskQuery = '#' + workitemId + taskQuery;
    }
    // Buid the workitem anchors
    $(rowQuery).each(function() {
        var selfRow = $(this);
        $(".taskSummary", selfRow).parent().addClass("taskSummaryCell");
        $('.taskSummary', selfRow).wrap('<a href="' + buildHref(SetWorkItem(selfRow)) + '"></a>');
        $("td:not(.not-workitem)", selfRow).click(function(e) {
            if (! (e.ctrlKey || e.shiftKey || e.altKey)) {
                window.location.href = buildHref(SetWorkItem(selfRow));
            }
        }).addClass("clickable");

        $(".creator, .runner, .mechanic", $(".who", selfRow)).addClass("linkTaskWho").click(
            function() {
                window.open('userinfo.php?id=' + $(this).attr("title"), '_blank');
            }
        );
    });
    // Add the hover over tooltip
    makeWorkitemTooltip(taskQuery);
}

// Is this function below needed or used somewhere?
function ToolTip() {
    xOffset = 10;
    yOffset = 20;
    var el_parent, el_child;
    $(".toolparent").hover(function(e){
        if (el_child) el_child.appendTo(el_parent).hide();
        el_parent = $(this);
        el_child = el_parent.children(".tooltip")
            .appendTo("body")
            .css("top",(e.pageY - xOffset) + "px")
            .css("left",(e.pageX + yOffset) + "px")
            .fadeIn("fast");
    },
    function(){
        if (el_child) el_child.appendTo(el_parent);
        $(".tooltip").hide();
        el_child = null;
    });
    $(".toolparent").mousemove(function(e){
        if (el_child) {
            el_child
                .css("top",(e.pageY - xOffset) + "px")
                .css("left",(e.pageX + yOffset) + "px");
        }
    });
}

function buildHref(item ) {
    return worklistUrl + "job/" + item;
}

function validateCodeReviews() {
    if (!$('#cr_anyone_field').is(':checked') && !$('#cr_3_favorites_field').is(':checked') && !$('#cr_project_admin_field').is(':checked') && !$('#cr_job_runner_field').is(':checked')) {
        $('#cr_anyone_field').prop('checked', true);
        $('#edit_cr_error').html("One selection must be checked");
        $('#edit_cr_error').fadeIn();
        $('#edit_cr_error').delay(2000).fadeOut();
        return false;
    };
    
};


function reattachAutoUpdate() {
    $("select[name=user], select[name=status], select[name=project]").change(function(){
        if ($("#search-filter").val() == 'UNPAID') {
            $(".worklist-fees").text('Unpaid');
        } else {
            $(".worklist-fees").text('Fees/Bids');
        }

        page = 1;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout('GetWorklist(' + page + ', false)', 50);
    });
}
