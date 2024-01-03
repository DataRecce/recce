class RecceException(Exception):
    def __init__(self, message):
        self.message = message
        super().__init__(self.message)


class RecceCancelException(RecceException):
    def __init__(self):
        super().__init__('Cancelled')
