// ==UserScript==
// @name         Immo-Helper
// @namespace    http://tampermonkey.net/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=immobilienscout24.de
// @version      0.4
// @description  Add and hide listings on different sites
// @author       Felix Jonas Wiegleb
// @match        https://www.immobilienscout24.de/Suche/*
// @match        https://www.kleinanzeigen.de/*
// @grant        GM_xmlhttpRequest
// @connect      immo.mathia.xyz
// @connect      localhost
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// ==/UserScript==

(function() {
    'use strict';

    const username = "tammo";
    const password = "tammo1234";
    const backendAddress = "http://localhost:3001";
    const shortTitleLength = 55;

    const siteConfigs = [
        {
            name: "ImmobilienScout24",
            hostname: "www.immobilienscout24.de",
            listingSelector: 'li.result-list__listing',
            idAttribute: 'data-id',
            getListingId: function(element) {
                return element.data('id');
            },
            getListingDetails: function(element) {
                let title = element.find('.result-list-entry__data a').first().text().trim();
                let address = element.find('.result-list-entry__address button').text().trim().split(", ");
                let url = element.find('.result-list-entry__data a').first().attr('href');

                if (element.hasClass('result-list__listing--xl')) {
                    title = element.find('.result-list-entry__brand-title').text().trim();
                }
                return { title, address: `${address[1]}, ${address[0]}`, url };
            }
        },
        {
            name: "Kleinanzeigen",
            hostname: "www.kleinanzeigen.de",
            listingSelector: 'li.ad-listitem',
            idAttribute: 'data-adid',
            getListingId: function(element) {
                return element.find('article.aditem').data('adid');
            },
            getListingDetails: function(element) {
                const article = element.find('article.aditem');
                const title = article.find('h2.text-module-begin .ellipsis').text().trim();
                const address = article.find('.aditem-main--top--left').text().trim();
                const url = article.attr('data-href');
                return { title, address, url: `https://www.kleinanzeigen.de${url}` };
            }
        }
    ];

    let config;

    /* globals jQuery, $, waitForKeyElements */

    function fetchListings(callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${backendAddress}/listings`,
            data: JSON.stringify({ username, password }),
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function(response) {
                if (response.status === 200) {
                    const listings = JSON.parse(response.responseText);
                    if (callback) {
                        callback(listings);
                    } else {
                        updateListings(listings);
                    }
                } else {
                    console.error('Error fetching listings:', response);
                }
            }
        });
    }

    function addButtons() {
        $(config.listingSelector).each(function() {
            const listingId = config.getListingId($(this));
            if (!listingId) return;

            if (!$(this).find('.immo-helper-buttons').length) {
                const buttonContainer = $('<div class="immo-helper-buttons"></div>');
                const addButton = $('<button class="immo-helper-button status-add">Gefällt mir</button>')
                    .click((e) => { e.preventDefault(); e.stopPropagation(); handleButtonClick(listingId, 'add'); });
                const maybeButton = $('<button class="immo-helper-button status-maybe">Mal schauen</button>')
                    .click((e) => { e.preventDefault(); e.stopPropagation(); handleButtonClick(listingId, 'maybe'); });
                const hideButton = $('<button class="immo-helper-button status-hide">Verstecken</button>')
                    .click((e) => { e.preventDefault(); e.stopPropagation(); handleButtonClick(listingId, 'hide'); });

                buttonContainer.append(addButton).append(maybeButton).append(hideButton);

                if (config.name === "Kleinanzeigen") {
                     $(this).find('.aditem-main').append(buttonContainer);
                } else {
                     $(this).append(buttonContainer);
                }
            }
        });
    }

    function updateListings(listings) {
        $(config.listingSelector).each(function() {
            const listingId = config.getListingId($(this));
            if (!listingId) return;

            const listing = listings.find(l => l.id == listingId);
            if (listing) {
                const resultElement = $(this);
                setElementByStatus(resultElement, listing.status, listingId, listing.user);
            }
        });
    }

    function handleButtonClick(listingId, action) {
        const resultElement = $(`${config.listingSelector}[${config.idAttribute}="${listingId}"], ${config.listingSelector}`).filter(function() {
            return String(config.getListingId($(this))) == String(listingId);
        });
        const details = config.getListingDetails(resultElement);
        const host = window.location.hostname;
        let shortenedTitle = details.title.length > shortTitleLength ? details.title.substring(0, shortTitleLength-3) + '...' : details.title

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${backendAddress}/${action}`,
            data: JSON.stringify({ listingId, username, password, title: shortenedTitle, host, url: details.url }),
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function(response) {
                if (response.status === 200) {
                    const resultElement = $(`${config.listingSelector}[${config.idAttribute}="${listingId}"], ${config.listingSelector}`).filter(function() {
                        return config.getListingId($(this)) == listingId;
                    });
                    setElementByStatus(resultElement, action, listingId, username);
                } else {
                    console.error('Error:', response);
                }
            }
        });
    }

    function setElementByStatus(resultElement, status, listingId, listedBy) {
        const details = config.getListingDetails(resultElement);

        let shortenedTitle = details.title.length > shortTitleLength ? details.title.substring(0, shortTitleLength-3) + '...' : details.title
        if (status === 'hide' || status === 'maybe') {
            const div = $(`
                <div class="collapsed status-${status}">
                    <div class="collapsed-content">
                        <div class="collapsed-title">${shortenedTitle}</div>
                        <div class="collapsed-address">${details.address}</div>
                    </div>
                    <div style="text-align: end; display: flex; flex-direction: column; justify-content: space-between">
                        <div><button class="undo-button">Undo</button></div>
                        <div style="font-style: italic; font-size: 12px">von ${listedBy}</div>
                    </div>
                </div>
            `);
            div.find('.collapsed-title').click(() => window.open(details.url, '_blank'));
            div.find('.undo-button').click((e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonClick(listingId, 'remove');
                resultElement.show();
                div.remove();
            });
            resultElement.hide().after(div);
        } else if (status === 'add') {
            resultElement.addClass('status-add-border');
        }
    }

    function showListingsModal() {
        fetchListings(function(listings) {
            const modal = $('#immo-helper-modal');
            const modalContent = modal.find('.immo-helper-modal-content');
            const listingsContainer = modal.find('.immo-helper-listings-container');
            listingsContainer.empty();

            const filteredListings = listings.filter(l => l.status === 'add' || l.status === 'maybe');

            filteredListings.forEach(listing => {
                const listingElement = $(`
                    <div class="immo-helper-listing status-${listing.status}">
                        <a href="${listing.url}" target="_blank">${listing.title}</a>
                    </div>
                `);
                listingsContainer.append(listingElement);
            });

            modal.show();
        });
    }

    function init() {
        const currentHostname = window.location.hostname;
        config = siteConfigs.find(site => site.hostname === currentHostname);
        if (!config) {
            console.log("Immo-Helper: No configuration for this site.");
            return;
        }

        const css = `
            .immo-helper-buttons {
                margin-top: 10px;
                text-align: center;
                z-index: 1000;
                position: relative;
            }
            .immo-helper-button {
                border: none;
                border-radius: 8px;
                color: white;
                padding: 2px 6px;
                font-size: 16px;
                margin-right: 5px;
                cursor: pointer;
                min-height: auto;
                height: auto;
            }
            .status-add { background-color: #04AA6D; }
            .status-add:hover { background-color: #04AA6D; opacity: 0.8; }
            .status-hide { background-color: #555555; }
            .status-hide:hover { background-color: #555555; opacity: 0.8; }
            .status-maybe { background-color: #d19120; }
            .status-maybe:hover { background-color: #d19120; opacity: 0.8; }
            .undo-button {
                border: none;
                border-radius: 3px;
                color: white;
                padding: 2px 4px;
                font-size: 12px;
                background-color: #ec9494;
                cursor: pointer;
                min-height: auto;
                height: auto;
            }
            .undo-button:hover { background-color: #ec9494; opacity: 0.8; }
            .collapsed {
                display: flex;
                border-radius: 8px;
                padding: 6px 12px;
                margin: 12px 0;
                font-size: 16px;
            }
            .collapsed.status-add { border: solid #04AA6D; background-color: #a8e2cd; }
            .collapsed.status-hide { border: solid #adadad; background-color: #e2e2e2; }
            .collapsed.status-maybe { border: solid #d19120; background-color: #f7dcb4; }
            .collapsed-title {
                cursor: pointer;
                display: inline-block;
                margin-right: 18px;
                font-weight: bold;
            }
            .status-hide .collapsed-title,
            .status-hide .collapsed-address { color: #878787; }
            .collapsed-content { flex-grow: 1; }
            .status-add-border {
                border: 2px solid #04AA6D;
                background-color: #e7f3ef;
                border-radius: 8px;
            }
            #immo-helper-floating-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                background-color: #04AA6D;
                color: white;
                border: none;
                border-radius: 50%;
                width: 60px;
                height: 60px;
                font-size: 24px;
                cursor: pointer;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            #immo-helper-modal {
                display: none;
                position: fixed;
                z-index: 10000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                overflow: auto;
                background-color: rgba(0,0,0,0.4);
            }
            .immo-helper-modal-content {
                background-color: #fefefe;
                margin: 15% auto;
                padding: 20px;
                border: 1px solid #888;
                width: 80%;
                max-width: 600px;
                border-radius: 8px;
            }
            .immo-helper-modal-close {
                color: #aaa;
                float: right;
                font-size: 28px;
                font-weight: bold;
                cursor: pointer;
            }
            .immo-helper-listing {
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 4px;
            }
            .immo-helper-listing.status-add a { color: white; }
            .immo-helper-listing.status-maybe a { color: white; }
        `;

        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);

        const floatingButton = $('<button id="immo-helper-floating-button">🏠</button>');
        floatingButton.click(showListingsModal);
        $('body').append(floatingButton);

        const modal = $(`
            <div id="immo-helper-modal">
                <div class="immo-helper-modal-content">
                    <span class="immo-helper-modal-close">&times;</span>
                    <h2>Your Listings</h2>
                    <div class="immo-helper-listings-container"></div>
                </div>
            </div>
        `);
        modal.find('.immo-helper-modal-close').click(() => modal.hide());
        $('body').append(modal);

        addButtons();
        fetchListings();

        $(document).ajaxComplete(addButtons);

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    setTimeout(addButtons, 500);
                }
            });
        });
        const observerConfig = { childList: true, subtree: true };
        observer.observe(document.body, observerConfig);
    }

    $(document).ready(init);
})();