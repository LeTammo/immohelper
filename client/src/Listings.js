import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Listings = () => {
    const [listings, setListings] = useState([]);

    useEffect(() => {
        axios.get('http://localhost:3001/listings')
            .then(response => {
                setListings(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the listings!', error);
            });
    }, []);

    return (
        <div>
            <h1>Immo Helper Listings</h1>
            <div>
                {listings.map(listing => (
                    <div key={listing.id} style={{ backgroundColor: listing.status === 'added' ? 'green' : 'grey', padding: '6px 12px', fontSize: '16px', borderRadius: '8px', marginBottom: '10px' }}>
                        ID: {listing.id}, Status: {listing.status}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Listings;