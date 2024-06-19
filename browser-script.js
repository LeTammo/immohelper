// ==UserScript==
// @name         Immo-Helper
// @namespace    http://tampermonkey.net/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=immobilienscout24.de
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

    function fetchListings() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'http://localhost:3001/listings',
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
            const id = $(this).data('id');
            if (!$(this).find('.immo-helper-buttons').length) {
                const buttonContainer = $('<div class="immo-helper-buttons"></div>');
                const addButton = $('<button class="immo-helper-button green">Add</button>').click(() => handleButtonClick(id, 'add'));
                const hideButton = $('<button class="immo-helper-button grey">Hide</button>').click(() => handleButtonClick(id, 'hide'));

                buttonContainer.append(addButton).append(hideButton);
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
                let title = resultElement.find('.result-list-entry__brand-title').text().trim();
                if (title == "") {
                    title = resultElement.find('.result-list-entry__data').find('a').first().text().trim();
                }
                const address = resultElement.find('.result-list-entry__address button span').last().text().trim().split(", ");
                let url = resultElement.find('a.result-list-entry__brand-title-container').attr('href');
                if (url == undefined) {
                    url = resultElement.find('.result-list-entry__data').find('a').first().attr('href');
                }

                if (listing.status === 'added') {
                    const addedDiv = $(`
                            <div class="collapsed green">
                                <div class="collapsed-content">
                                    <div class="collapsed-title" style="font-weight: bold">${title}</div>
                                    <div>${address[1]}, ${address[0]}</div>
                                </div>
                                <div><button class="undo-button">Undo</button></div>
                            </div>
                        `);
                    addedDiv.find('.collapsed-title').click(() => window.open(url, '_blank'));
                    addedDiv.find('.undo-button').click(() => {
                        handleButtonClick(id, 'remove');
                        resultElement.show();
                        addedDiv.remove();
                    });
                    resultElement.hide().after(addedDiv);
                } else if (listing.status === 'hidden') {
                    const hiddenDiv = $(`
                            <div class="collapsed grey">
                                <div class="collapsed-content">
                                    <div class="collapsed-title" style="font-weight: bold">${title}</div>
                                    <div>${address[1]}, ${address[0]}</div>
                                </div>
                                <div><button class="undo-button">Undo</button></div>
                            </div>
                        `);
                    hiddenDiv.find('.collapsed-title').click(() => window.open(url, '_blank'));
                    hiddenDiv.find('.undo-button').click(() => {
                        handleButtonClick(id, 'remove');
                        resultElement.show();
                        hiddenDiv.remove();
                    });
                    resultElement.hide().after(hiddenDiv);
                }
            }
        });
    }

    function handleButtonClick(id, action) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: `http://localhost:3001/${action}`,
            data: JSON.stringify({ id }),
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function(response) {
                if (response.status === 200) {
                    const resultElement = $(`li[data-id="${id}"]`);
                    let title = resultElement.find('.result-list-entry__brand-title').text().trim();
                    if (title == "") {
                        title = resultElement.find('.result-list-entry__data').find('a').first().text().trim();
                    }
                    const address = resultElement.find('.result-list-entry__address button span').last().text().trim().split(", ");
                    let url = resultElement.find('a.result-list-entry__brand-title-container').attr('href');
                    if (url == undefined) {
                        url = resultElement.find('.result-list-entry__data').find('a').first().attr('href');
                    }

                    if (action === 'add') {
                        const addedDiv = $(`
                            <div class="collapsed green">
                                <div class="collapsed-content">
                                    <div class="collapsed-title" style="font-weight: bold">${title}</div>
                                    <div>${address[1]}, ${address[0]}</div>
                                </div>
                                <div><button class="undo-button">Undo</button></div>
                            </div>
                        `);
                        addedDiv.find('.collapsed-title').click(() => window.open(url, '_blank'));
                        addedDiv.find('.undo-button').click(() => {
                            handleButtonClick(id, 'remove');
                            resultElement.show();
                            addedDiv.remove();
                        });
                        resultElement.hide().after(addedDiv);
                    } else if (action === 'hide') {
                        const hiddenDiv = $(`
                            <div class="collapsed grey">
                                <div class="collapsed-content">
                                    <div class="collapsed-title" style="font-weight: bold">${title}</div>
                                    <div>${address[1]}, ${address[0]}</div>
                                </div>
                                <div><button class="undo-button">Undo</button></div>
                            </div>
                        `);
                        hiddenDiv.find('.collapsed-title').click(() => window.open(url, '_blank'));
                        hiddenDiv.find('.undo-button').click(() => {
                            handleButtonClick(id, 'remove');
                            resultElement.show();
                            hiddenDiv.remove();
                        });
                        resultElement.hide().after(hiddenDiv);
                    }
                } else {
                    console.error('Error:', response);
                }
            }
        });
    }

    const css = `
        .immo-helper-button {
            border: none;
            border-radius: 8px;
            color: white;
            padding: 6px 12px;
            font-size: 16px;
            margin-right: 5px;
            cursor: pointer;
        }
        .green {
            background-color: #04AA6D;
        }
        .grey {
            background-color: #555555;
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
        .collapsed.green {
            border: solid #04AA6D;
            background-color: #a8e2cd;
        }
        .collapsed.grey {
            border: solid #adadad;
            background-color: #e2e2e2;
        }
        .collapsed-title {
            cursor: pointer;
            display: inline-block;
            margin-right: 18px;
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