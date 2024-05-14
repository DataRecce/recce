# Configuration file for recce
from rich.console import Console

from recce import yaml
from recce.util import SingletonMeta

RECCE_CONFIG_FILE = 'recce.yml'
RECCE_PRESET_CHECK_EXAMPLE = '''
- name: <Check Name>
  description: <Check Description>
  type: <Type of Check>
    view_options:
      model: xxx
      column: xxx
'''
RECCE_ERROR_LOG_FILE = 'recce_error.log'
console = Console()


class RecceConfig(metaclass=SingletonMeta):
    def __init__(self, config_file=RECCE_CONFIG_FILE):
        self.config_file = config_file
        self.config = None
        self.load()

    def load(self):
        try:
            with open(self.config_file, 'r') as f:
                self.config = yaml.safe_load(f)
        except FileNotFoundError:
            console.print(f'Recce config file not found. Generating default config file at \'{self.config_file}\'')
            self.config = self.generate_template()
            self.save()

    def generate_template(self):
        data = yaml.CommentedMap(
            github={'repo': ''},
            checks=[])
        data.yaml_set_comment_before_after_key('github', before='[Optional] GitHub settings')
        data.yaml_set_comment_before_after_key('checks',
                                               before='Recce Preset Checks',
                                               after=f'Example of preset check: {RECCE_PRESET_CHECK_EXAMPLE}')

        return data

    def get(self, key, default=None):
        return self.config.get(key, default)

    def set(self, key, value):
        self.config[key] = value

    def save(self):
        with open(RECCE_CONFIG_FILE, 'w') as f:
            yaml.dump(self.config, f)

    def __str__(self):
        return yaml.dump(self.config)

    def __repr__(self):
        return self.__str__()
