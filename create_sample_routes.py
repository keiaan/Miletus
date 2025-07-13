#!/usr/bin/env python3
"""
Script to create sample route history data for testing the route audit feature
"""

import json
import uuid
from datetime import datetime, timedelta

def create_sample_route_history():
    # Load existing route history or create new
    try:
        with open('route_history.json', 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        data = {'route_history': {}}

    # Sample data for EightNode
    eightnode_data = {
        'id': str(uuid.uuid4()),
        'timestamp': (datetime.now() - timedelta(days=1)).isoformat(),
        'company': 'EightNode',
        'data': {
            'results': [
                {
                    'driver': 'Mike Johnson (07123456789)',
                    'route': [
                        'Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK',
                        '123 High Street, Redditch, B97 4DE, UK',
                        '456 Church Road, Redditch, B97 5AB, UK',
                        '789 Victoria Street, Redditch, B98 7CD, UK',
                        'Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK'
                    ],
                    'total_distance': '12.5 miles',
                    'total_time': '1 hour, 45 minutes, 30 seconds',
                    'num_stops': 3
                },
                {
                    'driver': 'Sarah Williams (07987654321)',
                    'route': [
                        'Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK',
                        '321 Birmingham Road, Redditch, B97 6EF, UK',
                        '654 Evesham Road, Redditch, B97 5GH, UK',
                        'Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK'
                    ],
                    'total_distance': '8.3 miles',
                    'total_time': '1 hour, 15 minutes, 20 seconds',
                    'num_stops': 2
                }
            ],
            'num_drivers_used': 2,
            'total_addresses_served': 5,
            'delivery_counts': {
                'total_required': 5,
                'total_served': 5
            },
            'missed_addresses': []
        }
    }

    # Sample data for Ask Retrofit
    ask_retrofit_data = {
        'id': str(uuid.uuid4()),
        'timestamp': (datetime.now() - timedelta(hours=6)).isoformat(),
        'company': 'Ask Retrofit',
        'data': {
            'results': [
                {
                    'driver': 'Tom Brown (07111222333)',
                    'route': [
                        'Ask Retrofit-UK, Devon Way, Longbridge, Birmingham, UK',
                        '100 Broad Street, Birmingham, B1 2HF, UK',
                        '200 Corporation Street, Birmingham, B4 6QB, UK',
                        '300 New Street, Birmingham, B2 4QA, UK',
                        'Ask Retrofit-UK, Devon Way, Longbridge, Birmingham, UK'
                    ],
                    'total_distance': '18.7 miles',
                    'total_time': '2 hours, 30 minutes, 45 seconds',
                    'num_stops': 3
                }
            ],
            'num_drivers_used': 1,
            'total_addresses_served': 3,
            'delivery_counts': {
                'total_required': 4,
                'total_served': 3
            },
            'missed_addresses': [
                ['400 Colmore Row, Birmingham, B3 2QD, UK', 'Exceeds max distance (Distance: 25.3 miles)']
            ]
        }
    }

    # More recent data for EightNode
    eightnode_recent = {
        'id': str(uuid.uuid4()),
        'timestamp': datetime.now().isoformat(),
        'company': 'EightNode',
        'data': {
            'results': [
                {
                    'driver': 'James Wilson (07444555666)',
                    'route': [
                        'Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK',
                        '50 Alcester Road, Redditch, B98 8AE, UK',
                        '75 Unicorn Hill, Redditch, B97 4QR, UK',
                        'Don Pulentos, Unit 7 New Meadow Rd, Redditch B98 8YW, UK'
                    ],
                    'total_distance': '6.2 miles',
                    'total_time': '55 minutes, 10 seconds',
                    'num_stops': 2
                }
            ],
            'num_drivers_used': 1,
            'total_addresses_served': 2,
            'delivery_counts': {
                'total_required': 2,
                'total_served': 2
            },
            'missed_addresses': []
        }
    }

    # Initialize company data if not exists
    if 'EightNode' not in data['route_history']:
        data['route_history']['EightNode'] = []
    if 'Ask Retrofit' not in data['route_history']:
        data['route_history']['Ask Retrofit'] = []

    # Add the sample data
    data['route_history']['EightNode'].extend([eightnode_data, eightnode_recent])
    data['route_history']['Ask Retrofit'].append(ask_retrofit_data)

    # Save the updated data
    with open('route_history.json', 'w') as f:
        json.dump(data, f, indent=2)

    print('✅ Route history data created successfully!')
    print(f'📊 EightNode routes: {len(data["route_history"]["EightNode"])}')
    print(f'📊 Ask Retrofit routes: {len(data["route_history"]["Ask Retrofit"])}')
    print('\n🔍 You can now view the route audit page to see the sample data.')

if __name__ == '__main__':
    create_sample_route_history()
