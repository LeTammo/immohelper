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

(function () {
    'use strict';

    const GLOBAL_USERNAME = ""; // set to "" to be prompted
    const GLOBAL_PASSWORD = ""; // set to "" to be prompted
    const GLOBAL_LISTNAME = ""; // set to "" to be prompted
    const backendAddress = "http://localhost:3001";
    const shortTitleLength = 85;

    let username = GLOBAL_USERNAME || sessionStorage.getItem('immo_username');
    let password = GLOBAL_PASSWORD || sessionStorage.getItem('immo_password');
    let listName = GLOBAL_LISTNAME || sessionStorage.getItem('immo_listname');
    let isLoggedIn = username && password && listName;

    const siteConfigs = [
        {
            name: "ImmobilienScout24",
            hostname: "www.immobilienscout24.de",
            listingSelector: '.listing-card',
            idAttribute: 'data-obid',
            getListingId: function (element) {
                return element.attr('data-obid');
            },
            getListingDetails: function (element) {
                let titleElement = element.find('h2[data-testid="headline"]').first();
                let title = titleElement.length ? titleElement.text().trim() : 'Unknown Title';

                let addressElement = element.find('div[data-testid="hybridViewAddress"]').first();
                let address = addressElement.length ? addressElement.text().trim() : "Unknown Address";

                let link = element.find('a[href]').first();
                let url = link.attr('href') || window.location.href;
                if (!url.startsWith('http')) {
                    url = 'https://www.immobilienscout24.de' + url;
                }

                let priceElement = element.find('[data-testid="attributes"] dl:nth-child(1) dd').first();
                let priceStr = priceElement.length ? priceElement.text().trim() : '';
                let price = parseFloat(priceStr.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;

                return { title, address, url, price };
            }
        },
        {
            name: "Kleinanzeigen",
            hostname: "www.kleinanzeigen.de",
            listingSelector: 'li.ad-listitem',
            idAttribute: 'data-adid',
            getListingId: function (element) {
                return element.find('article.aditem').data('adid');
            },
            getListingDetails: function (element) {
                const article = element.find('article.aditem');
                const title = article.find('h2.text-module-begin .ellipsis').text().trim();
                const address = article.find('.aditem-main--top--left').text().trim();
                const url = article.attr('data-href');
                const priceStr = article.find('.aditem-main--middle--price-shipping--price').text().trim();
                const price = parseFloat(priceStr.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
                return { title, address, url: `https://www.kleinanzeigen.de${url}`, price };
            }
        }
    ];

    let config;

    /* globals jQuery, $, waitForKeyElements */

    function fetchListings(callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${backendAddress}/listings`,
            data: JSON.stringify({ username, password, listName }),
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function (response) {
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
        if (!isLoggedIn) return;
        $(config.listingSelector).each(function () {
            const listingId = config.getListingId($(this));
            if (!listingId) return;

            if ($(this).hasClass('status-add-border') || $(this).hasClass('status-maybe-border') || $(this).next('.collapsed').length) {
                return;
            }

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
                $(this).addClass('immo-listing-active');
            }
        });
    }

    function updateListings(listings) {
        if (!isLoggedIn) return;
        $(config.listingSelector).each(function () {
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
        const resultElement = $(`${config.listingSelector}[${config.idAttribute}="${listingId}"], ${config.listingSelector}`).filter(function () {
            return String(config.getListingId($(this))) == String(listingId);
        });
        const details = config.getListingDetails(resultElement);
        const host = window.location.hostname;
        let shortenedTitle = details.title.length > shortTitleLength ? details.title.substring(0, shortTitleLength - 3) + '...' : details.title

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${backendAddress}/${action}`,
            data: JSON.stringify({ listingId, username, password, listName, title: shortenedTitle, host, url: details.url, price: details.price }),
            headers: {
                'Content-Type': 'application/json'
            },
            onload: function (response) {
                if (response.status === 200) {
                    const resultElement = $(`${config.listingSelector}[${config.idAttribute}="${listingId}"], ${config.listingSelector}`).filter(function () {
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

        let shortenedTitle = details.title.length > shortTitleLength ? details.title.substring(0, shortTitleLength - 3) + '...' : details.title
        if (status === 'hide') {
            resultElement.find('.immo-helper-buttons').remove();
            resultElement.removeClass('immo-listing-active');
            const div = $(`
                <div class="collapsed status-hide">
                    <div class="collapsed-content">
                        <div class="collapsed-title">Eintrag versteckt</div>
                    </div>
                    <div style="display: flex; align-items: center;"><button class="undo-button">Undo</button></div>
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
        } else if (status === 'add' || status === 'maybe') {
            resultElement.show();
            resultElement.next('.collapsed').remove();
            resultElement.removeClass('status-add-border status-maybe-border immo-listing-active');
            resultElement.addClass(`status-${status}-border`);

            let buttonContainer = resultElement.find('.immo-helper-buttons');
            buttonContainer.empty();
            let undoButton = $('<button class="undo-button">Undo</button>');
            undoButton.click((e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonClick(listingId, 'remove');
            });
            buttonContainer.append(undoButton);
        } else if (status === 'remove') {
            resultElement.show();
            resultElement.next('.collapsed').remove();
            resultElement.removeClass('status-add-border status-maybe-border');
            resultElement.addClass('immo-listing-active');
            resultElement.find('.immo-helper-buttons').remove();
            addButtons();
        }
    }

    function showListingsModal() {
        const modal = $('#immo-helper-modal');
        const container = modal.find('.immo-helper-listings-container');
        container.empty();

        if (!isLoggedIn) {
            container.append(`
                <div style="margin-bottom: 10px;">
                    <label>Username (optional, or use local):</label><br>
                    <input type="text" id="immo-input-user" value="${username || ''}" style="width: 100%; border: 1px solid #ccc; padding: 4px; border-radius: 4px;" />
                </div>
                <div style="margin-bottom: 10px;">
                    <label>Password:</label><br>
                    <input type="password" id="immo-input-pass" value="${password || ''}" style="width: 100%; border: 1px solid #ccc; padding: 4px; border-radius: 4px;" />
                </div>
                <div style="margin-bottom: 10px;">
                    <label>List Name:</label><br>
                    <input type="text" id="immo-input-list" value="${listName || ''}" style="width: 100%; border: 1px solid #ccc; padding: 4px; border-radius: 4px;" />
                </div>
                <button id="immo-btn-login" style="background-color: #04AA6D; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Login / Join List</button>
            `);
            $('#immo-btn-login').click(() => {
                const u = $('#immo-input-user').val();
                const p = $('#immo-input-pass').val();
                const l = $('#immo-input-list').val();
                if (u && p && l) {
                    sessionStorage.setItem('immo_username', u);
                    sessionStorage.setItem('immo_password', p);
                    sessionStorage.setItem('immo_listname', l);
                    username = u;
                    password = p;
                    listName = l;
                    isLoggedIn = true;
                    showListingsModal();
                    addButtons();
                    fetchListings();
                } else {
                    alert("Please fill all fields");
                }
            });
            modal.show();
            return;
        }

        fetchListings(function (listings) {
            const filteredListings = listings
                .filter(l => l.status === 'add' || l.status === 'maybe')
                .sort((a, b) => (a.price || 0) - (b.price || 0));

            const hosts = [...new Set(filteredListings.map(l => l.host))];
            if (hosts.length === 0) {
                container.append('<p>No listings saved.</p>');
            } else {
                const tabsHtml = hosts.map((host, i) => `
                     <button class="immo-tab-btn" data-host="${host}" style="margin-right: 5px; padding: 5px 10px; border: 1px solid #ccc; background: ${i === 0 ? '#ddd' : '#fff'}; cursor: pointer;">
                        ${host}
                     </button>
                 `).join('');
                container.append(`<div style="margin-bottom: 15px;">${tabsHtml}</div><div id="immo-tab-content"></div>`);

                const renderHost = (currHost) => {
                    $('#immo-tab-content').empty();
                    filteredListings.filter(l => l.host === currHost).forEach(listing => {
                        const listingElement = $(`
                             <div class="immo-helper-listing status-${listing.status}">
                                 <a href="${listing.url}" target="_blank">${listing.title}</a>
                                 <span style="float: right; font-weight: bold;">${listing.price ? listing.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : ''}</span>
                             </div>
                         `);
                        $('#immo-tab-content').append(listingElement);
                    });
                    $('.immo-tab-btn').css('background', '#fff');
                    $(`.immo-tab-btn[data-host="${currHost}"]`).css('background', '#ddd');
                };

                renderHost(hosts[0]);
                $('.immo-tab-btn').click(function () {
                    renderHost($(this).data('host'));
                });
            }

            container.append(`<hr><button id="immo-btn-logout" style="background-color: #d19120; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; float: right; margin-top: 10px;">Logout</button>`);
            $('#immo-btn-logout').click(() => {
                sessionStorage.removeItem('immo_username');
                sessionStorage.removeItem('immo_password');
                sessionStorage.removeItem('immo_listname');
                username = GLOBAL_USERNAME;
                password = GLOBAL_PASSWORD;
                listName = GLOBAL_LISTNAME;
                isLoggedIn = username && password && listName;
                modal.hide();
                window.location.reload();
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
            .immo-listing-active {
                padding: 3px;
                border-radius: 8px;
                box-shadow: 0 2px 9px rgba(0, 0, 0, 0.3);
            }
            .immo-helper-buttons {
                text-align: center;
                z-index: 1000;
                position: relative;
                margin-top: 5px;
                margin-bottom: 5px;
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
                padding: 1px 2px;
                font-size: 8px;
                background-color: #ec9494;
                cursor: pointer;
                min-height: auto;
                height: auto;
            }
            .undo-button:hover { background-color: #ec9494; opacity: 0.8; }
            .collapsed {
                display: flex;
                border-radius: 8px;
                padding: 3px 8px;
                margin: 4px 0;
                font-size: 16px;
            }
            .collapsed.status-add { border: solid #04AA6D; background-color: #a8e2cd; }
            .collapsed.status-hide { border: solid #adadad; background-color: #e2e2e2; }
            .collapsed.status-maybe { border: solid #d19120; background-color: #f7dcb4; }
            .collapsed-title {
                cursor: pointer;
                display: inline-block;
                margin-right: 18px;
                font-size: 10px;
                font-weight: bold;
            }
            .status-hide .collapsed-title,
            .status-hide .collapsed-address { color: #878787; }
            .collapsed-content { flex-grow: 1; margin: auto }
            .status-add-border {
                padding: 3px;
                box-shadow: 0 2px 9px rgb(54 139 108);
                background-color: #e7f3ef;
                border-radius: 8px;
                margin: 12px 0;
            }
            .status-maybe-border {
                padding: 3px;
                box-shadow: 0 2px 9px rgba(209, 145, 32, 1);
                background-color: #fcf1e0;
                border-radius: 8px;
                margin: 12px 0;
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
                max-width: 900px;
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
        if (isLoggedIn) {
            fetchListings();
        }

        $(document).ajaxComplete(addButtons);

        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
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