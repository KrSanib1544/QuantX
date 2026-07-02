import datetime
from airflow import DAG
from airflow.operators.bash import BashOperator

default_args = {
    'owner': 'quantx_admin',
    'depends_on_past': False,
    'start_date': datetime.datetime(2026, 6, 1),
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': datetime.timedelta(minutes=5),
}

with DAG(
    'quantx_model_retraining',
    default_args=default_args,
    description='Automated weekly retraining for QuantX forecasting models and RL agent',
    schedule_interval='0 0 * * 0', # Weekly on Sunday at midnight
    catchup=False,
    tags=['quantx', 'mlops', 'retraining'],
) as dag:

    # Task 1: Weekly Retrain of Forecasting Models (LSTM, GRU, Transformer)
    retrain_forecasters = BashOperator(
        task_id='retrain_forecasters',
        bash_command='export PYTHONPATH="." && .venv/Scripts/python.exe ml/forecasting/train.py',
    )

    # Task 2: Weekly Retrain of Reinforcement Learning Trading Agent (PPO)
    retrain_rl_agent = BashOperator(
        task_id='retrain_rl_agent',
        bash_command='export PYTHONPATH="." && .venv/Scripts/python.exe ml/reinforcement_learning/rl_agent.py',
    )

    # Execution order: Retrain forecasters first, then retrain RL agent
    retrain_forecasters >> retrain_rl_agent
