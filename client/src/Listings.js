import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Listings = ({ user }) => {
    const [listings, setListings] = useState([]);
    const [activeTab, setActiveTab] = useState('');

    useEffect(() => {
        if (user && user.listName) {
            axios.post('http://localhost:3001/listings', user)
                .then(response => {
                    setListings(response.data);
                    if (response.data.length > 0) {
                        const hosts = [...new Set(response.data.map(l => l.host))];
                        if (hosts.length > 0) setActiveTab(hosts[0]);
                    }
                })
                .catch(error => {
                    console.error('There was an error fetching the listings!', error);
                });
        }
    }, [user]);

    const hosts = [...new Set(listings.map(l => l.host))];
    const filteredListings = listings.filter(l => l.host === activeTab);

    return (
        <div>
            <h1>Immo Helper Listings (List: {user?.listName})</h1>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                {hosts.map(host => (
                    <button 
                        key={host} 
                        onClick={() => setActiveTab(host)}
                        style={{ fontWeight: activeTab === host ? 'bold' : 'normal', padding: '5px 10px' }}
                    >
                        {host}
                    </button>
                ))}
            </div>
            <div>
                {filteredListings.length === 0 && <p>No listings for this source.</p>}
                {filteredListings.map(listing => (
                    <div key={listing.id} style={{ backgroundColor: listing.status === 'add' ? 'green' : (listing.status === 'maybe' ? 'orange' : 'grey'), padding: '6px 12px', fontSize: '16px', borderRadius: '8px', marginBottom: '10px' }}>
                        ID: {listing.id}, Status: {listing.status}, Title: {listing.title}, Host: {listing.host}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Listings;