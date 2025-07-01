import requests
import time
import argparse
from collections import Counter
from colorama import init, Fore, Style
import os

# Initialize colorama
init(autoreset=True)

# ANSI code to clear screen
CLEAR_SCREEN = '\033[2J\033[H'

# Fields to count (remains for internal statistics)
FIELDS = [
    'chainId', 'type', 'nonce', 'gas', 'maxFeePerGas', 'maxPriorityFeePerGas',
    'to', 'value', 'accessList', 'input', 'r', 's', 'yParity', 'v', 'hash',
    'blockHash', 'blockNumber', 'transactionIndex', 'from', 'gasPrice'
]

def fetch_txpool_stats(url, num_requests):
    stats = {
        'requests_sent': 0,
        'responses_received': 0,
        'response_times': [],
        'transactions_found': 0,
        'addresses_found': 0,
        'unique_addresses': set(),
        'pending_count': 0,
        'queued_count': 0,
        'field_counts': Counter(),
    }

    start_time = time.time()

    for i in range(num_requests):
        # Send JSON-RPC request
        stats['requests_sent'] += 1
        payload = {'jsonrpc': '2.0', 'method': 'txpool_content', 'params': [], 'id': i}
        req_start = time.time()
        try:
            resp = requests.post(url, json=payload, timeout=10)
            req_end = time.time()
            stats['response_times'].append(req_end - req_start)
            stats['responses_received'] += 1

            result = resp.json().get('result', {})
            for category in ('pending', 'queued'):
                tx_map = result.get(category, {})
                stats['addresses_found'] += len(tx_map)
                stats['unique_addresses'].update(tx_map.keys())
                for txs in tx_map.values():
                    for tx in txs.values():
                        stats['transactions_found'] += 1
                        if category == 'pending':
                            stats['pending_count'] += 1
                        else:
                            stats['queued_count'] += 1
                        for field in FIELDS:
                            if field in tx:
                                stats['field_counts'][field] += 1
        except Exception as e:
            print(Fore.RED + f"Request {i} failed: {e}")

        # Clear screen and print stats without any tables or decorative separators
        os.stdout.write(CLEAR_SCREEN)
        elapsed = time.time() - start_time
        avg_time = (sum(stats['response_times']) / len(stats['response_times'])) if stats['response_times'] else 0

        print(Fore.CYAN + f"Requests sent: {stats['requests_sent']}" + Style.RESET_ALL)
        print(Fore.CYAN + f"Responses received: {stats['responses_received']}" + Style.RESET_ALL)
        print(Fore.MAGENTA + f"Full duration (s): {elapsed:.4f}" + Style.RESET_ALL)
        print(Fore.MAGENTA + f"Average response time (s): {avg_time:.4f}" + Style.RESET_ALL)
        print(Fore.WHITE + f"Transactions found: {stats['transactions_found']}" + Style.RESET_ALL)
        print(Fore.WHITE + f"Addresses found: {stats['addresses_found']}" + Style.RESET_ALL)
        print(Fore.WHITE + f"Unique addresses: {len(stats['unique_addresses'])}" + Style.RESET_ALL)
        print(Fore.YELLOW + f"Pending tx count: {stats['pending_count']}" + Style.RESET_ALL)
        print(Fore.BLUE + f"Queued tx count: {stats['queued_count']}" + Style.RESET_ALL)

        # Small pause for display clarity
        time.sleep(0.1)

    # Completion message
    print(Style.BRIGHT + Fore.GREEN + "\nCompleted stats collection!" + Style.RESET_ALL)

def main():
    parser = argparse.ArgumentParser(description="Live JSON-RPC txpool_content stats without table output")
    parser.add_argument('--url', required=True, help='JSON-RPC server URL')
    parser.add_argument('--requests', type=int, default=10, help='Number of requests to send')
    args = parser.parse_args()

    fetch_txpool_stats(args.url, args.requests)

if __name__ == '__main__':
    main()
