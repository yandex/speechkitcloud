from setuptools import setup

setup(
    name='asrclient',
    version='0.3.1',
    author='Andrey Pichugin, Alexander Artemenko',
    author_email='voice@support.yandex.ru',
    description='Yandex ASR streaming client.',
    long_description=open('README.txt', 'r').read(),
    url='http://api.yandex.ru/speechkit/cloud-api/',
    platforms=['Any'],
    license='GNU GPLv3',
    packages=['asrclient'],
    install_requires=['protobuf', 'click'],
    scripts=['asrclient-cli.py'] 
    )
