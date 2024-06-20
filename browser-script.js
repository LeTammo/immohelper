// ==UserScript==
// @name         Immo-Helper
// @namespace    http://tampermonkey.net/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=immobilienscout24.de
// @version      0.3
// @description  Add and hide listings on ImmobilienScout24
// @author       Felix Jonas Wiegleb
// @match        https://www.immobilienscout24.de/Suche/*
// @grant        GM_xmlhttpRequest
// @connect      immo.mathia.xyz
// @connect      localhost
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';

    const name = "Amronas";
    const address = "http://localhost:3001";

    /* globals jQuery, $, waitForKeyElements */

    function fetchListings() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${address}/listings`,
            onload: function(response) {
                if (response.status === 200) {
                    const listings = JSON.parse(response.responseText);
                    updateListings(listings);
                } else {
                    console.error('Error fetching listings:', response);
                }
            }
        });
    }

    function addButtons() {
        $('li.result-list__listing').each(function() {
            if ($(this).find('.result-list-entry__grouped-listings').children().length > 1) {
                return;
            }
            const id = $(this).data('id');
            if (!$(this).find('.immo-helper-buttons').length) {
                const buttonContainer = $('<div class="immo-helper-buttons"></div>');
                const addButton = $('<button class="immo-helper-button status-add">Add</button>').click(() => handleButtonClick(id, 'add'));
                const maybeButton = $('<button class="immo-helper-button status-maybe">Maybe</button>').click(() => handleButtonClick(id, 'maybe'));
                const hideButton = $('<button class="immo-helper-button status-hide">Hide</button>').click(() => handleButtonClick(id, 'hide'));

                buttonContainer.append(addButton).append(hideButton).append(maybeButton);
                $(this).append(buttonContainer);
            }
        });
    }

    function updateListings(listings) {
        $('li.result-list__listing').each(function() {
            const id = $(this).data('id');
            const listing = listings.find(listing => listing.id == id);
            if (listing) {
                const resultElement = $(this);
                setElementByStatus(resultElement, listing.status, id, listing.user);
            }
        });
    }

    function handleButtonClick(id, action) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${address}/${action}`,
            data: JSON.stringify({ id, name }),
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function(response) {
                if (response.status === 200) {
                    const resultElement = $(`li[data-id="${id}"]`);
                    setElementByStatus(resultElement, action, id, name);
                } else {
                    console.error('Error:', response);
                }
            }
        });
    }

    function setElementByStatus(resultElement, status, id, listedBy) {
        const title = resultElement.find('.result-list-entry__data').find('a').first().text().trim();
        const address = resultElement.find('.result-list-entry__address button span').last().text().trim().split(", ");
        const url = resultElement.find('.result-list-entry__data').find('a').first().attr('href');

        if (status === 'add' || status === 'hide' || status === 'maybe') {
            const div = $(`
                            <div class="collapsed status-${status}">
                                <div class="collapsed-content">
                                    <div class="collapsed-title">${title}</div>
                                    <div class="collapsed-address">${address[1]}, ${address[0]}</div>
                                </div>
                                <div style="text-align: end; display: flex; flex-direction: column; justify-content: space-between">
                                    <div><button class="undo-button">Undo</button></div>
                                    <div style="font-style: italic; font-size: 12px">von ${listedBy}</div>
                                </div>
                            </div>
                        `);
            div.find('.collapsed-title').click(() => window.open(url, '_blank'));
            div.find('.undo-button').click(() => {
                handleButtonClick(id, 'remove');
                resultElement.show();
                div.remove();
            });
            resultElement.hide().after(div);
        }
    }

    const css = `
        .immo-helper-buttons {
            margin-top: 2px;
            text-align: center;
        }
        .immo-helper-button {
            border: none;
            border-radius: 8px;
            color: white;
            padding: 6px 12px;
            font-size: 16px;
            margin-right: 5px;
            cursor: pointer;
        }
        .status-add {
            background-color: #04AA6D;
        }
        .status-hide {
            background-color: #555555;
        }
        .status-maybe {
            background-color: #d19120;
        }
        .undo-button {
            border: none;
            border-radius: 3px;
            color: white;
            padding: 2px 4px;
            font-size: 12px;
            background-color: #ec9494;
            cursor: pointer;
        }
        .collapsed {
            display: flex;
            border-radius: 8px;
            padding: 6px 12px;
            margin: 12px 0;
            font-size: 16px;
            border-radius: 8px;
        }
        .collapsed.status-add {
            border: solid #04AA6D;
            background-color: #a8e2cd;
        }
        .collapsed.status-hide {
            border: solid #adadad;
            background-color: #e2e2e2;
        }
        .collapsed.status-maybe {
            border: solid #d19120;
            background-color: #f7dcb4;
        }
        .collapsed-title {
            cursor: pointer;
            display: inline-block;
            margin-right: 18px;
            font-weight: bold;
        }
        .status-hide .collapsed-title,
        .status-hide .collapsed-address {
            color: #878787;
        }
        .collapsed-content {
            flex-grow: 1;
        }
    `;

    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    $(document).ready(() => {
        addButtons();
        fetchListings();
    });
    $(document).ajaxComplete(addButtons);
})();