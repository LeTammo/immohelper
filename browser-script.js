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

    const username = "Amronas";
    const backendAddress = "http://localhost:3001";
    const shortTitleLength = 45;

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
                const title = article.find('.aditem-main--middle h2 a').text().trim();
                const address = article.find('.aditem-main--top--left').text().trim();
                const url = article.find('a').first().attr('href');
                return { title, address, url: `https://www.kleinanzeigen.de${url}` };
            }
        }
    ];

    let config;

    /* globals jQuery, $, waitForKeyElements */

    function fetchListings() {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${backendAddress}/listings`,
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
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${backendAddress}/${action}`,
            data: JSON.stringify({ listingId, username }),
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
        if (status === 'add' || status === 'hide' || status === 'maybe') {
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
        }
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
        `;

        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);

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