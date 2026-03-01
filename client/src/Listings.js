import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Listings = ({ user }) => {
    const [listings, setListings] = useState([]);

    useEffect(() => {
        if (user) {
            axios.post('http://localhost:3001/listings', user)
                .then(response => {
                    setListings(response.data);
                })
                .catch(error => {
                    console.error('There was an error fetching the listings!', error);
                });
        }
    }, [user]);

    return (
        <div>
            <h1>Immo Helper Listings</h1>
            <div>
                {listings.map(listing => (
                    <div key={listing.id} style={{ backgroundColor: listing.status === 'add' ? 'green' : (listing.status === 'maybe' ? 'orange' : 'grey'), padding: '6px 12px', fontSize: '16px', borderRadius: '8px', marginBottom: '10px' }}>
                        ID: {listing.id}, Status: {listing.status}, Title: {listing.title}, Host: {listing.host}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Listings;