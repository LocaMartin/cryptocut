import time
import requests  # <-- Add the missing import
import argparse
from collections import Counter
from rich.console import Console, Group
from rich.live import Live
from rich.text import Text
from rich.rule import Rule

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

    fields = [
        'chainId', 'type', 'nonce', 'gas', 'maxFeePerGas', 'maxPriorityFeePerGas',
        'to', 'value', 'accessList', 'input', 'r', 's', 'yParity', 'v', 'hash',
        'blockHash', 'blockNumber', 'transactionIndex', 'from', 'gasPrice'
    ]

    start_time = time.time()
    console = Console()

    def render_stats():
        elapsed = time.time() - start_time
        avg_time = (sum(stats['response_times']) / len(stats['response_times'])) if stats['response_times'] else 0

        lines = []
        # Header
        lines.append(Rule("Live TXPool Content Stats"))
        # Basic metrics
        lines.append(Text(f"Requests sent: {stats['requests_sent']}", style="cyan"))
        lines.append(Text(f"Responses received: {stats['responses_received']}", style="cyan"))
        lines.append(Text(f"Full duration (s): {elapsed:.4f}", style="magenta"))
        lines.append(Text(f"Average response time (s): {avg_time:.4f}", style="magenta"))
        # TX and address stats
        lines.append(Text(f"Transactions found: {stats['transactions_found']}", style="white"))
        lines.append(Text(f"Addresses found: {stats['addresses_found']}", style="white"))
        lines.append(Text(f"Unique addresses: {len(stats['unique_addresses'])}", style="white"))
        lines.append(Text(f"Pending tx count: {stats['pending_count']}", style="yellow"))
        lines.append(Text(f"Queued tx count: {stats['queued_count']}", style="bright_blue"))
        # Field counts
        lines.append(Rule())
        lines.append(Text("Field occurrence counts:", style="bold white"))
        for field in fields:
            count = stats['field_counts'].get(field, 0)
            lines.append(Text(f"  {field}: {count}", style="white"))
        lines.append(Rule())
        return Group(*lines)

    # Live updating stats
    with Live(render_stats(), refresh_per_second=4, console=console):
        for i in range(num_requests):
            stats['requests_sent'] += 1
            payload = {'jsonrpc': '2.0', 'method': 'txpool_content', 'params': [], 'id': i}
            req_start = time.time()
            try:
                resp = requests.post(url, json=payload, timeout=10)
                req_end = time.time()
                stats['response_times'].append(req_end - req_start)
                stats['responses_received'] += 1

                data = resp.json().get('result', {})
                for category in ['pending', 'queued']:
                    tx_map = data.get(category, {})
                    stats['addresses_found'] += len(tx_map)
                    stats['unique_addresses'].update(tx_map.keys())
                    for txs in tx_map.values():
                        for tx in txs.values():
                            stats['transactions_found'] += 1
                            if category == 'pending':
                                stats['pending_count'] += 1
                            else:
                                stats['queued_count'] += 1
                            for field in fields:
                                if field in tx:
                                    stats['field_counts'][field] += 1
            except Exception as e:
                console.log(f"[red]Request {i} failed:[/] {e}")
            time.sleep(0.1)

    # Final snapshot
    console.print(render_stats())


def main():
    parser = argparse.ArgumentParser(description="Live JSON-RPC txpool_content stats without tables")
    parser.add_argument('--url', required=True, help='JSON-RPC server URL')
    parser.add_argument('--requests', type=int, default=10, help='Number of requests to send')
    parser.add_argument('--one2n', help='One to N requests (infinite loop until error or null id in response)', action='store_true', default=False)
    args = parser.parse_args()
    fetch_txpool_stats(args.url, args.requests)


if __name__ == '__main__':
    main()
