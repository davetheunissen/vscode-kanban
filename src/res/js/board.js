
let allCards;
let boardSettings;
let currentUser;
let nextKanbanCardId;
let vsckb_update_card_interval = false;
let vsckb_is_updating_card_creation_times = false;

function vsckb_foreach_card(action, cards) {
    if (arguments.length < 2) {
        cards = allCards;
    }

    if (cards) {
        let i = -1;
        let ti = -1;

        for (const TYPE in cards) {
            ++ti;

            const CARD_LIST = cards[TYPE];

            if (CARD_LIST) {
                CARD_LIST.forEach((c) => {
                    ++i;

                    if (action) {
                        action(c, i, TYPE, ti);
                    }
                });
            }
        }
    }
}

function vsckb_get_assigned_to_val(field) {
    let assignedTo = vsckb_to_string( field.val() ).trim();
    if ('' === assignedTo) {
        assignedTo = undefined;
    } else {
        assignedTo = {
            name: assignedTo
        };
    }

    return assignedTo;
}

function vsckb_get_card_colors_by_type(cardType) {
    const COLORS = {
        background: 'bg-info',
        text: 'text-white'
    };

    switch (vsckb_normalize_str(cardType)) {
        case 'bug':
            COLORS.background = 'bg-dark';
            break;

        case 'emergency':
            COLORS.background = 'bg-danger';
            break;

        default:
            COLORS.text = 'text-dark';
            break;
    }

    return COLORS;
}

function vsckb_get_card_count() {
    let count = 0;
    vsckb_foreach_card(() => {
        ++count;
    });

    return count;
}

function vsckb_get_card_description(desc) {
    if (!vsckb_is_nil(desc)) {
        if ('object' !== typeof desc) {
            desc = {
                content: desc
            };
        }

        desc = vsckb_clone(desc);

        let mime = vsckb_normalize_str(desc.mime);
        switch (mime) {
            case 'text/markdown':
                break;
                
            default:
                mime = 'text/plain';
                break;
        }

        desc.content = vsckb_to_string(desc.content);
        desc.mime = mime;
    }

    return desc;
}

function vsckb_get_card_description_markdown(field) {
    let description = vsckb_to_string(
        field.val()
    );

    if ('' === description.trim()) {
        description = undefined;
    } else {
        description = {
            content: description,
            mime: 'text/markdown'
        };
    }

    return description;
}

function vsckb_get_card_prio_sort_val(item) {
    let prio = parseFloat(
        vsckb_to_string(item.prio).trim()
    );

    if (isNaN(prio)) {
        prio = 0;
    }

    return prio;
}

function vsckb_get_card_type_sort_val(item) {
    switch (vsckb_normalize_str(item.type)) {
        case 'emergency':
            return -2;

        case 'bug':
            return -1;
    }

    return 0;
}

function vsckb_get_cards_sorted(type) {
    return allCards[type].sort((x, y) => {
        // first compare by prio (DESC)
        const COMP_0 = vsckb_get_card_prio_sort_val( y ) - 
                       vsckb_get_card_prio_sort_val( x );
        if (0 !== COMP_0) {
            return COMP_0;
        }

        // then by type
        const COMP_1 = vsckb_get_card_type_sort_val( x ) - 
                       vsckb_get_card_type_sort_val( y );
        if (0 !== COMP_1) {
            return COMP_1;
        }

        // then by title
        return vsckb_get_sort_val( vsckb_normalize_str(x.title), 
                                   vsckb_normalize_str(y.title) );
    });
}

function vsckb_get_prio_val(field) {
    let prio = vsckb_to_string(
        field.val()
    ).trim();

    if ('' === prio) {
        return undefined;
    }

    prio = parseFloat(
        prio
    );

    return isNaN(prio) ? false
                       : prio;
}

function vsckb_get_user_list() {
    const USERS = [];
    const ADD_UNIQUE = (name) => {
        name = vsckb_to_string(name).trim();
        if ('' !== name) {
            if (USERS.map(x => vsckb_normalize_str(x)).indexOf( vsckb_normalize_str(name) ) < 0) {
                USERS.push(name);

                return true;
            }
        }

        return false;
    };

    const CUR_USER = currentUser;
    if (CUR_USER) {
        ADD_UNIQUE(
            CUR_USER.name
        );
    }

    const ALL_CARDS = allCards;
    if (ALL_CARDS) {
        for (const TYPE in ALL_CARDS) {
            for (const ITEM of ALL_CARDS[TYPE]) {
                if (ITEM.assignedTo) {
                    ADD_UNIQUE( ITEM.assignedTo.name );
                }
            }
        }    
    }

    return USERS.sort((x, y) => {
        return vsckb_get_sort_val( vsckb_normalize_str(x) ) - 
               vsckb_get_sort_val( vsckb_normalize_str(y) );
    });
}

function vsckb_refresh_card_view(onAdded) {
    try {
        if (false !== vsckb_update_card_interval) {
            clearInterval(vsckb_update_card_interval);
        }
    } catch (e) { }
    finally {
        vsckb_update_card_interval = false;
    }

    nextKanbanCardId = -1;

    let canTrackTime = false;
    let hideTimeTrackingIfIdle = false;

    const BOARD_SETTINGS = boardSettings;
    if (BOARD_SETTINGS) {
        if (!vsckb_is_nil(BOARD_SETTINGS.canTrackTime)) {
            canTrackTime = !!BOARD_SETTINGS.canTrackTime;
        }

        if (!vsckb_is_nil(BOARD_SETTINGS.hideTimeTrackingIfIdle)) {
            hideTimeTrackingIfIdle = !!BOARD_SETTINGS.hideTimeTrackingIfIdle;
        }
    }

    for (const TYPE in allCards) {
        const CARD = jQuery(`#vsckb-card-${ TYPE }`);
        const CARD_BODY = CARD.find('.vsckb-primary-card-body');

        CARD_BODY.html('');

        vsckb_get_cards_sorted(TYPE).forEach((i) => {
            let itemSetup = false;

            ++nextKanbanCardId;

            const CARD_TYPE = TYPE;

            const NEW_ITEM = jQuery('<div class="vsckb-kanban-card border border-dark">' +
                                    '<div class="vsckb-kanban-card-col vsckb-kanban-card-type font-weight-bold" />' + 
                                    '<div class="vsckb-kanban-card-info bg-white text-dark">'  +
                                    '<div class="vsckb-kanban-card-title font-weight-bold" />'  +
                                    '<div class="vsckb-kanban-card-category" />'  +
                                    '<div class="vsckb-kanban-card-progress" />' + 
                                    '<div class="vsckb-kanban-card-body" />'  +
                                    '</div>'  +
                                    '<div class="vsckb-kanban-card-footer text-dark">' +
                                    '<div class="vsckb-buttons float-right" />' + 
                                    '</div>'  +
                                    '</div>');

            const NEW_ITEM_TYPE = NEW_ITEM.find('.vsckb-kanban-card-type');

            const NEW_ITEM_INFO = NEW_ITEM.find('.vsckb-kanban-card-info');
            const NEW_ITEM_INFO_BODY = NEW_ITEM_INFO.find('.vsckb-kanban-card-body');

            const NEW_ITEM_CATEGORY = NEW_ITEM.find('.vsckb-kanban-card-category');
            NEW_ITEM_CATEGORY.hide();

            const NEW_ITEM_PROGRESS = NEW_ITEM.find('.vsckb-kanban-card-progress');
            NEW_ITEM_PROGRESS.hide();

            NEW_ITEM.find('.vsckb-kanban-card-info');

            const NEW_ITEM_COLORS = vsckb_get_card_colors_by_type( i.type );
            NEW_ITEM.find('.vsckb-kanban-card-type')
                    .addClass( NEW_ITEM_COLORS.background )
                    .addClass( NEW_ITEM_COLORS.text );

            // track time button
            if (canTrackTime) {
                let showTrackTimeButton = true;

                if (hideTimeTrackingIfIdle) {
                    if (['todo', 'done'].indexOf(CARD_TYPE) > -1) {
                        showTrackTimeButton = false;
                    }
                }

                if (showTrackTimeButton) {
                    const TRACK_TIME_BTN = jQuery('<a class="btn btn-sm" title="Track Time">' + 
                                                  '<i class="fa fa-clock-o" aria-hidden="true"></i>' + 
                                                  '</a>');
                    
                    TRACK_TIME_BTN.on('click', function() {
                        vsckb_raise_event('track_time', {
                            card: i,
                            column: CARD_TYPE
                        });
                    });

                    TRACK_TIME_BTN.appendTo( NEW_ITEM_TYPE );
                }
            }

            // edit button
            const EDIT_BTN = jQuery('<a class="btn btn-sm" title="Edit Card">' + 
                                    '<i class="fa fa-pencil-square-o" aria-hidden="true"></i>' + 
                                    '</a>');

            {
                EDIT_BTN.on('click', function() {
                    const WIN = jQuery('#vsckb-edit-card-modal');
                    const WIN_BODY = WIN.find('.modal-body');
                    const WIN_HEADER = WIN.find('.modal-header');

                    let user;
                    if (i.assignedTo) {
                        user = i.assignedTo.name;
                    }            

                    const TITLE_FIELD = WIN_BODY.find('#vsckb-edit-card-title');
                    TITLE_FIELD.val( vsckb_to_string(i.title) );

                    let descriptionOverflow = '';

                    const DESCRIPTION_FIELD = WIN.find('#vsckb-edit-card-description');
                    {
                        let descriptionToSet = '';

                        const DESC = vsckb_get_card_description( i.description );
                        if (DESC) {
                            descriptionToSet = vsckb_to_string(
                                DESC.content
                            );
                        }

                        if (descriptionToSet.length > 255) {
                            descriptionToSet = descriptionToSet.substr(0, 255);
                            descriptionOverflow = descriptionToSet.substr(255);
                        }

                        DESCRIPTION_FIELD.val( descriptionToSet );
                    }

                    if ('' === descriptionOverflow.trim()) {
                        descriptionOverflow = '';
                    }

                    const DETAILS_FIELD = WIN.find('#vsckb-edit-card-details');
                    {
                        let detailsToSet = '';

                        const DETAILS = vsckb_get_card_description( i.details );
                        if (DETAILS) {
                            detailsToSet = vsckb_to_string(
                                DETAILS.content
                            );
                        }

                        if ('' === detailsToSet.trim()) {
                            detailsToSet = '';
                        }
    
                        let sep = '';
                        if (descriptionOverflow.length > 0 && detailsToSet.length > 0) {
                            sep = "\n\n";
                        }

                        DETAILS_FIELD.val( descriptionOverflow + sep + detailsToSet );
                    }

                    const TYPE_FIELD = WIN.find('#vsckb-edit-card-type');
                    TYPE_FIELD.val( vsckb_normalize_str(i.type) );

                    const PRIO_FIELD = WIN.find('#vsckb-edit-card-prio');
                    PRIO_FIELD.val( vsckb_to_string(i.prio).trim() );
                    
                    const CATEGORY_FIELD = WIN.find('#vsckb-edit-card-category');
                    CATEGORY_FIELD.val( vsckb_to_string(i.category).trim() );

                    const ASSIGNED_TO_FIELD = WIN.find('#vsckb-edit-card-assigned-to');
                    ASSIGNED_TO_FIELD.val( vsckb_to_string(user) );

                    WIN.attr('vsckb-type', CARD_TYPE);

                    vsckb_win_header_from_card_type(WIN_HEADER, CARD_TYPE);

                    WIN.find('.modal-footer .vsckb-save-btn').off('click').on('click', function() {
                        const TITLE = vsckb_to_string(
                            TITLE_FIELD.val()
                        ).trim();
                        if ('' === TITLE) {
                            TITLE_FIELD.focus();
                            return;
                        }

                        const PRIO = vsckb_get_prio_val(PRIO_FIELD);
                        if (false === PRIO) {
                            PRIO_FIELD.focus();
                            return;
                        }
                        
                        let type = vsckb_normalize_str( TYPE_FIELD.val() );
                        if ('' === type) {
                            type = undefined;
                        }

                        let category = vsckb_to_string( CATEGORY_FIELD.val() ).trim();
                        if ('' === category) {
                            category = undefined;
                        }

                        i.assignedTo = vsckb_get_assigned_to_val(ASSIGNED_TO_FIELD);
                        i.title = TITLE;
                        i.description = vsckb_get_card_description_markdown( DESCRIPTION_FIELD );
                        i.details = vsckb_get_card_description_markdown( DETAILS_FIELD );
                        i.prio = PRIO;
                        i.type = type;
                        i.category = category;
                        
                        vsckb_save_board();
            
                        vsckb_refresh_card_view((ctx) => {
                            if (ctx.item !== i) {
                                return;
                            }

                            let oldCard;
                            try {
                                oldCard = JSON.parse(
                                    JSON.stringify(i)
                                );
                            } catch (e) { }

                            vsckb_raise_event('card_updated', {
                                card: i,
                                column: CARD_TYPE,
                                oldCard: oldCard
                            });
                        });
            
                        WIN.modal('hide');
                    });

                    WIN.modal('show');
                });

                EDIT_BTN.appendTo( NEW_ITEM_TYPE );
            }

            // delete button
            const DELETE_BTN = jQuery('<a class="btn btn-sm" title="Delete Card">' + 
                                      '<i class="fa fa-trash" aria-hidden="true"></i>' + 
                                      '</a>');
            {
                DELETE_BTN.on('click', function() {
                    const WIN = jQuery('#vsckb-delete-card-modal');

                    WIN.find('.modal-footer .vsckb-no-btn').off('click').on('click', function() {
                        WIN.modal('hide');
                    });

                    WIN.find('.modal-footer .vsckb-yes-btn').off('click').on('click', function() {
                        vsckb_remove_item(i);
                        
                        vsckb_save_board();

                        vsckb_refresh_card_view((ctx) => {
                            if (ctx.item !== i) {
                                return;
                            }

                            vsckb_raise_event('card_deleted', {
                                card: i,
                                column: CARD_TYPE
                            });
                        });
                        
                        WIN.modal('hide');
                    });

                    const CONFIRM_MSG = jQuery(`<span>Are you sure to delete <strong class="vsckb-title" /> card of <strong class="vsckb-type" />?</span>`);

                    CONFIRM_MSG.find('.vsckb-title').text(
                        i.title
                    );
                    CONFIRM_MSG.find('.vsckb-type').text(
                        jQuery(`#vsckb-card-${ CARD_TYPE } .vsckb-primary-card-header span.vsckb-title`).text()
                    );

                    WIN.find('.modal-body')
                       .html('')
                       .append( CONFIRM_MSG );

                    WIN.modal('show');
                });

                DELETE_BTN.appendTo( NEW_ITEM_TYPE );
            }

            NEW_ITEM_INFO.find('.vsckb-kanban-card-title')
                         .text( vsckb_to_string(i.title).trim() );

            let category = vsckb_to_string(i.category).trim();
            if ('' !== category) {
                NEW_ITEM_CATEGORY.text( category );
                NEW_ITEM_CATEGORY.show();
            }

            const APPEND_CARD_CONTENT = (cardContentObj, target, ifAppended) => {
                cardContentObj = vsckb_get_card_description( cardContentObj );
                if (cardContentObj) {
                    const CARD_CONTENT = vsckb_to_string( cardContentObj.content );
                    if ('' !== CARD_CONTENT.trim()) {
                        let html;

                        switch (vsckb_normalize_str(cardContentObj.mime)) {
                            case 'text/markdown':
                                html = vsckb_from_markdown(
                                    CARD_CONTENT
                                );
                                break;

                            default:
                                html = vsckb_to_string(
                                    jQuery('<span />').text(CARD_CONTENT)
                                                      .html()
                                ).trim()
                                 .split('\n').join('<br />');
                                break;
                        }

                        if (target) {
                            target.append(
                                html
                            );    
                        }

                        if (ifAppended) {
                            ifAppended( html );
                        }
                    }
                }
            };

            APPEND_CARD_CONTENT(
                i.description, NEW_ITEM_INFO_BODY,
                () => {
                    itemSetup = () => {
                        vsckb_apply_highlight(
                            NEW_ITEM_INFO_BODY
                        );  
                    };
                }
            );

            APPEND_CARD_CONTENT(
                i.details, null,
                (html) => {
                    NEW_ITEM_INFO_BODY.on('click', function() {
                        const WIN = jQuery('#vsckb-card-details-modal');

                        // bg-warning
                        const WIN_HEADER = WIN.find('.modal-header');
                        WIN_HEADER.attr('class', 'modal-header');

                        const WIN_HEADER_COLORS = vsckb_get_card_colors_by_type( i.type );
                        WIN_HEADER.addClass( WIN_HEADER_COLORS.background )
                                  .addClass( WIN_HEADER_COLORS.text );

                        const WIN_HEADER_TITLE = WIN_HEADER.find('.modal-title');
                        WIN_HEADER_TITLE.text( vsckb_to_string(i.title) );

                        const WIN_BODY = WIN.find('.modal-body');
                        WIN_BODY.html('');

                        WIN_BODY.append( html );
                        vsckb_apply_highlight( WIN_BODY );

                        WIN.find('.modal-footer .vsckb-edit-btn').off('click').on('click', () => {
                            WIN.modal('hide');

                            jQuery('#vsckb-edit-card-modal').attr('vsckb-select-pane', 
                                                                  'vsckb-edit-card-details-tab-pane');
                            EDIT_BTN.trigger('click');
                        });

                        WIN.modal('show');
                    });

                    NEW_ITEM_INFO_BODY.addClass( 'vsckb-has-card-details' );
                    NEW_ITEM_INFO_BODY.attr('title', 'Click here to view details ...');
                }
            );

            const UPDATE_BORDER = (borderClass, borderWidth) => {
                NEW_ITEM.removeClass('border-dark')
                        .removeClass('border-primary')
                        .addClass(borderClass);
            };

            NEW_ITEM.on('mouseleave', function() {
                UPDATE_BORDER('border-dark');
            }).on('mouseenter', function() {
                UPDATE_BORDER('border-primary');
            });

            NEW_ITEM.appendTo(CARD_BODY);

            vsckb_update_card_item_footer(NEW_ITEM, i);

            if (false !== itemSetup) {
                itemSetup();
            }

            // progress bar5
            {
                const TEMP = jQuery('<span>' + 
                                    '<div class="vsckb-description" />' + 
                                    '<div class="vsckb-details" />' + 
                                    '</span>');
                const TEMP_DESCRIPTION = TEMP.find('.vsckb-description');
                const TEMP_DETAILS = TEMP.find('.vsckb-details');

                APPEND_CARD_CONTENT(i.description, TEMP_DESCRIPTION, () => {
                    vsckb_apply_highlight( TEMP_DESCRIPTION );
                });
                APPEND_CARD_CONTENT(i.details, TEMP_DETAILS, () => {
                    vsckb_apply_highlight( TEMP_DETAILS );
                });

                // task items
                const ALL_TASK_ITEMS = TEMP.find('ul.vsckb-task-list li.task-list-item input[type="checkbox"]');
                if (ALL_TASK_ITEMS.length > 0) {
                    let checkItems = 0;
                    ALL_TASK_ITEMS.each(function() {
                        const TASK_ITEM = jQuery(this);

                        if (TASK_ITEM.prop('checked')) {
                            ++checkItems;
                        }
                    });

                    if (checkItems > 0) {
                        const PERCENTAGE = checkItems / ALL_TASK_ITEMS.length * 100.0;

                        const NEW_ITEM_PROGRESS_BAR = jQuery('<div class="vsckb-kanban-card-progress-bar" />');
                        NEW_ITEM_PROGRESS_BAR.css('width', Math.floor(PERCENTAGE) + '%');

                        if (PERCENTAGE < 50.0) {
                            NEW_ITEM_PROGRESS_BAR.addClass('bg-danger');
                        } else if (PERCENTAGE < 100.0) {
                            NEW_ITEM_PROGRESS_BAR.addClass('bg-warning');
                        } else {
                            NEW_ITEM_PROGRESS_BAR.addClass('bg-success');
                        }

                        NEW_ITEM_PROGRESS_BAR.appendTo( NEW_ITEM_PROGRESS );

                        NEW_ITEM_PROGRESS.attr('title', `${ PERCENTAGE.toFixed(1) } %`);
                        NEW_ITEM_PROGRESS.show();
                    }
                }

                TEMP.remove();
            }

            if (onAdded) {
                onAdded({
                    element: NEW_ITEM,
                    item: i,
                    type: CARD_TYPE
                });
            }
        });
    }

    vsckb_update_card_creation_times();

    vsckb_update_card_interval = setInterval(() => {
        vsckb_update_card_creation_times();
    }, 20000);
}

function vsckb_reload_board() {
    vsckb_post(
        'reloadBoard'
    );
}

function vsckb_remove_item(item) {
    const ALL_CARS = allCards;

    if (ALL_CARS) {
        for (const CARD_TYPE in ALL_CARS) {
            ALL_CARS[CARD_TYPE] = ALL_CARS[CARD_TYPE].filter(x => x !== item);
        }    
    }
}

function vsckb_save_board() {
    const ALL_CARDS = vsckb_clone(
        allCards
    );

    vsckb_foreach_card((card) => {
        delete card['__uid'];
    }, ALL_CARDS);

    vsckb_post('saveBoard',
               ALL_CARDS);
}

function vsckb_setup_assigned_to(field, user) {
    user = vsckb_normalize_str(user);

    let newVal = '';

    if ('' !== user) {
        for (const U of vsckb_get_user_list()) {
            if (vsckb_normalize_str(U) === user) {
                newVal = U;
            }
        }
    }

    if (false !== newVal) {
        field.val( newVal );
    }
}

function vsckb_update_card_creation_times() {
    if (vsckb_is_updating_card_creation_times) {
        return;
    }

    vsckb_is_updating_card_creation_times = true;
    try {
        jQuery('.vsckb-kanban-card .vsckb-kanban-card-footer .vsckb-creation-time').each(function() {
            try {
                const CREATION_TIME = jQuery(this);
                CREATION_TIME.hide();
                CREATION_TIME.html('');
                CREATION_TIME.attr('title', '');

                let time = vsckb_to_string( CREATION_TIME.attr('vsckb-time') ).trim();
                if ('' !== time) {
                    time = moment.utc(time);
                    if (time.isValid()) {
                        CREATION_TIME.text(
                            vsckb_to_pretty_time(time)
                        );
                        CREATION_TIME.attr('title',
                                           time.local().format('YYYY-MM-DD HH:mm:ss'));

                        CREATION_TIME.show();
                    }
                }
            } catch (e) { }
        });
    } finally {
        vsckb_is_updating_card_creation_times = false;
    }
}

function vsckb_update_card_item_footer(item, entry) {
    const CARD = item.parents('.vsckb-card');
    const CARD_ID = CARD.attr('id');
    const CARD_TYPE = CARD_ID.substr(11);

    const ITEM_FOOTER = item.find('.vsckb-kanban-card-footer');
    const ITEM_FOOTER_BUTTONS = ITEM_FOOTER.find('.vsckb-buttons');

    ITEM_FOOTER.hide();
    ITEM_FOOTER_BUTTONS.html('');

    const MOVE_CARD = (target) => {
        vsckb_remove_item(entry);
        allCards[target].push(entry);
        
        vsckb_save_board();

        vsckb_refresh_card_view((ctx) => {
            if (ctx.item !== entry) {
                return;
            }

            vsckb_raise_event('card_moved', {
                card: ctx.item,
                from: CARD_TYPE,
                to: target
            });
        });        
    };

    const ADD_DONE_BTN = () => {
        const DONE_BTN = jQuery('<a class="btn btn-sm" title="Move To \'Done\'">' + 
                                '<i class="fa fa-check-circle" aria-hidden="true"></i>' + 
                                '</a>');

        DONE_BTN.on('click', function() {
            MOVE_CARD('done');
        });

        DONE_BTN.appendTo( ITEM_FOOTER_BUTTONS );
    };

    const ADD_IN_PROGRESS_BTN = (icon) => {
        const IN_PROGRESS_BTN = jQuery('<a class="btn btn-sm" title="Move To \'In Progress\'">' + 
                                       '<i class="fa" aria-hidden="true"></i>' + 
                                       '</a>');
        IN_PROGRESS_BTN.find('.fa')
                       .addClass(`fa-${ icon }`);

        IN_PROGRESS_BTN.on('click', function() {
            MOVE_CARD('in-progress');
        });

        IN_PROGRESS_BTN.appendTo( ITEM_FOOTER_BUTTONS );
    };

    const ADD_TEST_BTN = () => {
        const TEST_BTN = jQuery('<a class="btn btn-sm" title="Move To \'Testing\'">' + 
                                '<i class="fa fa-heartbeat" aria-hidden="true"></i>' + 
                                '</a>');
        
        TEST_BTN.on('click', function() {
            MOVE_CARD('testing');
        });

        TEST_BTN.appendTo( ITEM_FOOTER_BUTTONS );
    };

    let isVisible = true;
    switch (CARD_TYPE) {
        case 'todo':
            {
                ADD_IN_PROGRESS_BTN('play-circle');
            }
            break;

        case 'in-progress':
            {
                const STOP_BTN = jQuery('<a class="btn btn-sm" title="Move To \'Todo\'">' + 
                                        '<i class="fa fa-stop-circle" aria-hidden="true"></i>' + 
                                        '</a>');
                STOP_BTN.on('click', function() {
                    MOVE_CARD('todo');
                });
                STOP_BTN.appendTo( ITEM_FOOTER_BUTTONS );

                ADD_TEST_BTN();                
                ADD_DONE_BTN();
            }
            break;

        case 'testing':
            {
                ADD_IN_PROGRESS_BTN('thumbs-down');
                ADD_DONE_BTN();
            }
            break;

        case 'done':
            {
                ADD_TEST_BTN();

                const REDO_BTN = jQuery('<a class="btn btn-sm" title="Move To \'In Progress\'">' + 
                                        '<i class="fa fa-refresh" aria-hidden="true"></i>' + 
                                        '</a>');
                REDO_BTN.on('click', function() {
                    MOVE_CARD('in-progress');
                });
                REDO_BTN.appendTo( ITEM_FOOTER_BUTTONS );
            }
            break;
    }

    let creation_time = vsckb_to_string(entry.creation_time).trim();
    if ('' !== creation_time) {
        try {
            creation_time = moment.utc(creation_time);
            if (creation_time.isValid()) {
                const CREATION_TIME_AREA = jQuery('<div class="vsckb-creation-time float-left" />');
                CREATION_TIME_AREA.attr('vsckb-time',
                                        creation_time.toISOString());

                CREATION_TIME_AREA.appendTo( ITEM_FOOTER );
            }
        } catch (e) { }
    }

    if (isVisible) {
        ITEM_FOOTER.show();
    }
}

function vsckb_win_header_from_card_type(header, type) {
    const WIN_CLOSE_BTN = header.find('button.close');

    header.removeClass('bg-primary')
          .removeClass('bg-secondary')
          .removeClass('bg-warning')
          .removeClass('bg-success')
          .removeClass('text-dark')
          .removeClass('text-white');

    WIN_CLOSE_BTN.removeClass('text-dark')
                 .removeClass('text-white');

    let bgHeaderClass = false;
    let textHeaderClass = false;
    let textCloseBtnClass = false;
    switch ( vsckb_normalize_str(type) ) {
        case 'todo':
            bgHeaderClass = 'bg-secondary';
            textHeaderClass = textCloseBtnClass = 'text-dark';
            break;

        case 'in-progress':
            bgHeaderClass = 'bg-primary';
            textHeaderClass = textCloseBtnClass = 'text-white';
            break;

        case 'testing':
            bgHeaderClass = 'bg-warning';
            textHeaderClass = textCloseBtnClass = 'text-white';
            break;

        case 'done':
            bgHeaderClass = 'bg-success';
            textHeaderClass = textCloseBtnClass = 'text-white';
            break;    
    }

    if (false !== bgHeaderClass) {
        header.addClass(bgHeaderClass);
    }
    if (false !== textHeaderClass) {
        header.addClass(textHeaderClass);
    }

    if (false !== textCloseBtnClass) {
        WIN_CLOSE_BTN.addClass(textCloseBtnClass);
    }
}


jQuery(() => {
    allCards = {
        'todo': [],
        'in-progress': [],
        'testing': [],
        'done': [],
    };
});

jQuery(() => {
    const WIN = jQuery('#vsckb-clear-done-modal');

    jQuery('#vsckb-card-done .vsckb-buttons .vsckb-clear-btn').on('click', function() {
        WIN.modal('show');
    });

    WIN.find('.modal-footer .vsckb-no-btn').on('click', function() {
        WIN.modal('hide');
    });
    
    WIN.find('.modal-footer .vsckb-yes-btn').on('click', function() {
        const CURRENT_LIST = allCards['done'];

        allCards['done'] = [];

        vsckb_save_board();

        vsckb_raise_event('column_cleared', {
            cards: CURRENT_LIST,
            column: 'done'
        });

        vsckb_refresh_card_view();

        WIN.modal('hide');
    });
});

jQuery(() => {
    const WIN = jQuery('#vsckb-add-card-modal');
    
    const TITLE_FIELD = WIN.find('#vsckb-new-card-title');
    const DESCRIPTION_FIELD = WIN.find('#vsckb-new-card-description');

    TITLE_FIELD.off('keyup').on('keyup', function(e) {
        if (13 == e.which) {
            e.preventDefault();
            DESCRIPTION_FIELD.focus();

            return;
        }
    });

    WIN.on('shown.bs.modal', function (e) {
        jQuery('a[href="#vsckb-new-card-description-tab-pane"]').tab('show');

        TITLE_FIELD.focus();
    });
});

jQuery(() => {
    const WIN = jQuery('#vsckb-edit-card-modal');
    
    WIN.on('shown.bs.modal', function (e) {
        let paneToSelect = vsckb_to_string(
            WIN.attr('vsckb-select-pane')
        ).trim();
        
        WIN.removeAttr('vsckb-select-pane');

        if ('' === paneToSelect) {
            paneToSelect = 'vsckb-edit-card-description-tab-pane';
        }

        const TAB_PANE = jQuery('#' + paneToSelect);

        jQuery(`a[href="#${ TAB_PANE.attr('id') }"]`).tab('show');

        TAB_PANE.find('textarea').focus();
    });
});

jQuery(() => {
    jQuery('body main .row .col .vsckb-card .vsckb-buttons .vsckb-add-btn').on('click', function() {
        const BTN = jQuery(this);

        const CARD = BTN.parent().parent().parent();
        const CARD_TITLE = CARD.find('.vsckb-primary-card-header span.vsckb-title');
        const TYPE = CARD.attr('id').substr(11).toLowerCase().trim();

        const WIN = jQuery('#vsckb-add-card-modal');
        const WIN_BODY = WIN.find('.modal-body');
        const WIN_FOOTER = WIN.find('.modal-footer');
        const WIN_HEADER = WIN.find('.modal-header');
        const WIN_TITLE = WIN_HEADER.find('.modal-title');

        const TITLE_FIELD = WIN_BODY.find('#vsckb-new-card-title');
        TITLE_FIELD.val('');

        const DESCRIPTION_FIELD = WIN.find('#vsckb-new-card-description');
        DESCRIPTION_FIELD.val('');
        
        const DETAILS_FIELD = WIN.find('#vsckb-new-card-details');
        DETAILS_FIELD.val('');

        const TYPE_FIELD = WIN.find('#vsckb-new-card-type');

        const ASSIGNED_TO_FIELD = WIN.find('#vsckb-new-card-assigned-to');
        const PRIO_FIELD = WIN.find('#vsckb-new-card-prio');

        const CATEGORY_FIELD = WIN.find('#vsckb-new-card-category');
        
        WIN.attr('vsckb-type', TYPE);

        vsckb_win_header_from_card_type(WIN_HEADER, TYPE);

        const WIN_TITLE_TEXT = jQuery('<span>Add Card To <strong class="vsckb-card-title" /></span>');
        WIN_TITLE_TEXT.find('.vsckb-card-title')
                      .text( "'" + CARD_TITLE.text() + "'" );

        WIN_TITLE.html('')
                 .append( WIN_TITLE_TEXT );

        WIN_FOOTER.find('.btn').off('click').on('click', function() {
            const TITLE = vsckb_to_string(
                TITLE_FIELD.val()
            ).trim();
            if ('' === TITLE) {
                TITLE_FIELD.focus();
                return;
            }

            const PRIO = vsckb_get_prio_val(PRIO_FIELD);
            if (false === PRIO) {
                PRIO_FIELD.focus();
                return;
            }

            let type = vsckb_normalize_str( TYPE_FIELD.val() );
            if ('' === type) {
                type = undefined;
            }

            let category = vsckb_to_string( CATEGORY_FIELD.val() ).trim();
            if ('' === category) {
                category = undefined;
            }

            const NEW_CARD = {
                assignedTo: vsckb_get_assigned_to_val( ASSIGNED_TO_FIELD ),
                category: category,
                creation_time: moment.utc().toISOString(),
                description: vsckb_get_card_description_markdown( DESCRIPTION_FIELD ),
                details: vsckb_get_card_description_markdown( DETAILS_FIELD ),
                prio: PRIO,
                title: TITLE,
                type: type
            };

            allCards[ TYPE ].push(NEW_CARD);
            
            vsckb_save_board();

            vsckb_refresh_card_view((ctx) => {
                if (ctx.item !== NEW_CARD) {
                    return;
                }

                vsckb_raise_event('card_created', {
                    card: ctx.item,
                    column: TYPE
                });
            });

            WIN.modal('hide');
        });

        WIN.modal('show');
    });
});

jQuery(() => {
    window.addEventListener('message', (e) => {
        if (!e) {
            return;
        }

        const MSG = e.data;
        if (!MSG) {
            return;
        }

        try {
            switch (MSG.command) {
                case 'setBoard':
                    {
                        allCards = MSG.data.cards;
                        boardSettings = MSG.data.settings;

                        vsckb_foreach_card((card, i) => {
                            card['__uid'] = `${ i }-${ Math.floor(Math.random() * 597923979) }-${ (new Date()).getTime() }`;
                        }, MSG.data.cards);

                        vsckb_refresh_card_view();
                    }
                    break;

                case 'setCardTag':
                    {
                        let saveBoard = false;

                        const TAG_DATA = MSG.data;
                        if (TAG_DATA) {
                            const UID = vsckb_to_string(TAG_DATA.uid).trim();

                            vsckb_foreach_card((card) => {
                                if (card['__uid'] === UID) {
                                    card.tag = TAG_DATA.tag;

                                    saveBoard = true;
                                }
                            });
                        }

                        if (saveBoard) {
                            vsckb_save_board();
                        }
                    }
                    break;

                case 'setCurrentUser':
                    if (MSG.data) {
                        currentUser = MSG.data;

                        const ASSIGNED_TO_FIELD = jQuery('#vsckb-new-card-assigned-to');
                        if ('' === vsckb_to_string( ASSIGNED_TO_FIELD.val() ).trim()) {
                            vsckb_setup_assigned_to(ASSIGNED_TO_FIELD,
                                                    MSG.data.name);
                        }
                    } else {
                        currentUser = undefined;
                    }
                    break;

                case 'setTitleAndFilePath':
                    {
                        let docTitle = 'Kanban Board';

                        const TITLE = vsckb_to_string(MSG.data.title).trim();
                        if ('' !== TITLE) {
                            docTitle = `${ docTitle } (${ TITLE })`;
                        }

                        jQuery('header nav.navbar .navbar-brand span').text(
                            docTitle
                        ).attr('title', vsckb_to_string(MSG.data.file).trim());
                    }
                    break;

                case 'webviewIsVisible':
                    {
                        const CARD_COUNT = vsckb_get_card_count();
                        if (CARD_COUNT < 1) {
                            vsckb_reload_board();
                        } else {
                            vsckb_refresh_card_view();
                        }
                    }
                    break;
            }
        } catch (e) {
            vsckb_log(`window.addEventListener.message: ${ vsckb_to_string(e) }`);
        }
    });
});

jQuery(() => {
    jQuery('.modal .modal-body .vsckb-card-type-list').each(function() {
        const LIST = jQuery(this);

        const SELECT = LIST.find('select');

        SELECT.append('<option value="bug">Bug / issue</option>')
              .append('<option value="emergency">Emergency</option>')
              .append('<option value="" selected>Note</option>');
    });
});

jQuery(() => {
    jQuery('.vsckb-card .vsckb-primary-card-body').each(function() {
        const CARD_BODY = jQuery(this);
        CARD_BODY.html('');

        const LOADER = jQuery('<img class="vsckb-ajax-loader" />');
        LOADER.attr('src', VSCKB_AJAX_LOADER_16x11);
        LOADER.appendTo( CARD_BODY );
    });
});

jQuery(() => {
    jQuery('#vsckb-reload-board-btn').on('click', function() {
        vsckb_reload_board();
    });

    jQuery('#vsckb-save-board-btn').on('click', function() {
        vsckb_save_board();
    });
});

jQuery(() => {
    vsckb_post('onLoaded');
});
